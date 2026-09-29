/**
 * Buyer messages and the owner inbox (IMPROVEMENTS E2, M1, M2, E3).
 * Buyer-facing calls (postPayMessage, getPayThread) take one invoice id, the pay-link credential,
 * and only ever touch that invoice's pay-page conversation. Owner calls are scoped by exporterId.
 * Outbound replies wait as "draft" until approved; only "sent" rows count anywhere else.
 */
import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";
import type { Db } from "./client";
import { newId } from "./ids";
import { toAction, toBuyer, toInvoice } from "./map";
import * as s from "./schema";
import type { AgentAction, Buyer, Invoice, InvoiceStatus, ReplyIntent } from "./types";

export const PAY_MESSAGE_MAX_CHARS = 1000;
export const PAY_MESSAGES_PER_HOUR = 5;
export const PAY_MESSAGES_PER_DAY = 20;

export type Channel = "email" | "pay_page" | "logged";
export type MessageStatus = "draft" | "sent" | "discarded";

export type ThreadMessage = {
  id: string;
  invoiceId: string;
  direction: "out" | "in";
  channel: Channel;
  status: MessageStatus;
  from: string;
  subject: string;
  body: string;
  classification?: { intent: ReplyIntent; confidence: number };
  inReplyTo?: string;
  createdAt: string;
};

/** What the buyer sees under the pay card. Nothing else leaves the server. */
export type PayThreadMessage = { id: string; from: "buyer" | "seller"; body: string; createdAt: string };

export type InboxThread = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  amountUsdc: bigint;
  buyerId: string;
  buyerName: string;
  last: { direction: "out" | "in"; channel: Channel; body: string; createdAt: string };
  lastIntent?: { intent: ReplyIntent; confidence: number };
  needsReply: boolean;
  hasDraft: boolean;
  count: number;
};

export type InboxThreadDetail = { invoice: Invoice; buyer: Buyer; messages: ThreadMessage[]; actions: Array<AgentAction & { approvedBy?: string }> };

export type PostResult =
  | { ok: true; messageId: string; invoiceId: string; exporterId: string; buyerId: string }
  | { ok: false; error: "not_found" | "empty" | "too_long" | "rate_limited" };

export type SendInput = { body: string; approvedBy: string; ruleId: string; decision: string; reason: string; confidence: number; at?: Date };

type Row = typeof s.messages.$inferSelect;

function toThreadMessage(r: Row): ThreadMessage {
  return {
    id: r.id,
    invoiceId: r.invoiceId,
    direction: r.direction,
    channel: r.channel,
    status: r.status,
    from: r.from,
    subject: r.subject,
    body: r.body,
    classification: r.classification ? { intent: r.classification.intent as ReplyIntent, confidence: r.classification.confidence } : undefined,
    inReplyTo: r.inReplyTo ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

export function createInboxStore(db: Db, opts: { appUrl?: string } = {}) {
  const appUrl = opts.appUrl ?? "";

  async function ownedInvoice(exporterId: string, invoiceId: string) {
    const [r] = await db
      .select({ invoice: s.invoices, buyer: s.buyers })
      .from(s.invoices)
      .innerJoin(s.buyers, eq(s.buyers.id, s.invoices.buyerId))
      .where(and(eq(s.invoices.id, invoiceId), eq(s.invoices.exporterId, exporterId)));
    return r ?? null;
  }

  async function ownedMessage(exporterId: string, messageId: string) {
    const [r] = await db
      .select({ m: s.messages, buyerId: s.invoices.buyerId })
      .from(s.messages)
      .innerJoin(s.invoices, eq(s.invoices.id, s.messages.invoiceId))
      .where(and(eq(s.messages.id, messageId), eq(s.invoices.exporterId, exporterId)));
    return r ?? null;
  }

  return {
    /** Buyer posts a question under the invoice (public, no login). */
    async postPayMessage(invoiceId: string, raw: string, o: { now?: Date } = {}): Promise<PostResult> {
      const now = o.now ?? new Date();
      const body = raw.trim();
      if (!body) return { ok: false, error: "empty" };
      if (body.length > PAY_MESSAGE_MAX_CHARS) return { ok: false, error: "too_long" };
      // Count and insert under a row lock on the invoice, so parallel posts can't all read "under the limit".
      return db.transaction(async (tx): Promise<PostResult> => {
        const [inv] = await tx
          .select({ id: s.invoices.id, status: s.invoices.status, exporterId: s.invoices.exporterId, buyerId: s.invoices.buyerId })
          .from(s.invoices)
          .where(eq(s.invoices.id, invoiceId))
          .for("update");
        if (!inv || inv.status === "draft") return { ok: false, error: "not_found" };
        const [buyer] = await tx.select({ contactName: s.buyers.contactName }).from(s.buyers).where(eq(s.buyers.id, inv.buyerId));

        const recent = await tx
          .select({ createdAt: s.messages.createdAt })
          .from(s.messages)
          .where(and(eq(s.messages.invoiceId, invoiceId), eq(s.messages.channel, "pay_page"), eq(s.messages.direction, "in"), gte(s.messages.createdAt, new Date(now.getTime() - 86_400_000))));
        const lastHour = recent.filter((r) => r.createdAt.getTime() > now.getTime() - 3_600_000 && r.createdAt.getTime() <= now.getTime()).length;
        if (lastHour >= PAY_MESSAGES_PER_HOUR || recent.length >= PAY_MESSAGES_PER_DAY) return { ok: false, error: "rate_limited" };

        const id = newId("msg");
        await tx.insert(s.messages).values({
          id, invoiceId, direction: "in", channel: "pay_page", status: "sent", from: buyer?.contactName ?? "", subject: "Message from the pay page", body, createdAt: now,
        });
        return { ok: true, messageId: id, invoiceId, exporterId: inv.exporterId, buyerId: inv.buyerId };
      });
    },

    /** The pay page's thread: this invoice's pay-page messages that were actually sent. Null = no such payable invoice. */
    async getPayThread(invoiceId: string): Promise<PayThreadMessage[] | null> {
      const [inv] = await db.select({ status: s.invoices.status }).from(s.invoices).where(eq(s.invoices.id, invoiceId));
      if (!inv || inv.status === "draft") return null;
      const rows = await db
        .select({ id: s.messages.id, direction: s.messages.direction, body: s.messages.body, createdAt: s.messages.createdAt })
        .from(s.messages)
        .where(and(eq(s.messages.invoiceId, invoiceId), eq(s.messages.channel, "pay_page"), eq(s.messages.status, "sent")))
        .orderBy(asc(s.messages.createdAt), asc(s.messages.id));
      return rows.map((r) => ({ id: r.id, from: r.direction === "in" ? "buyer" : "seller", body: r.body, createdAt: r.createdAt.toISOString() }));
    },

    /** E2.3: the owner pastes a message the buyer sent elsewhere (email, WhatsApp). */
    async logBuyerMessage(exporterId: string, input: { invoiceId: string; body: string; at?: Date }): Promise<ThreadMessage> {
      const owned = await ownedInvoice(exporterId, input.invoiceId);
      if (!owned) throw new Error("Invoice not found");
      const body = input.body.trim();
      if (!body) throw new Error("Paste the buyer's message first");
      const [row] = await db
        .insert(s.messages)
        .values({
          id: newId("msg"), invoiceId: input.invoiceId, direction: "in", channel: "logged", status: "sent",
          from: owned.buyer.contactName, subject: "Logged by you", body: body.slice(0, 8000), createdAt: input.at ?? new Date(),
        })
        .returning();
      return toThreadMessage(row!);
    },

    async setClassification(messageId: string, classification: { intent: ReplyIntent; confidence: number }): Promise<void> {
      await db.update(s.messages).set({ classification }).where(and(eq(s.messages.id, messageId), eq(s.messages.direction, "in")));
    },

    async listThreads(exporterId: string, filter: { buyerId?: string; view?: "all" | "needs_reply" | "disputed" } = {}): Promise<InboxThread[]> {
      const rows = await db
        .select({ m: s.messages, invoice: s.invoices, buyerName: s.buyers.name })
        .from(s.messages)
        .innerJoin(s.invoices, eq(s.invoices.id, s.messages.invoiceId))
        .innerJoin(s.buyers, eq(s.buyers.id, s.invoices.buyerId))
        .where(and(eq(s.invoices.exporterId, exporterId), ne(s.messages.status, "discarded"), filter.buyerId ? eq(s.invoices.buyerId, filter.buyerId) : undefined))
        .orderBy(asc(s.messages.createdAt), asc(s.messages.id));

      const byInvoice = new Map<string, typeof rows>();
      for (const r of rows) byInvoice.set(r.invoice.id, [...(byInvoice.get(r.invoice.id) ?? []), r]);

      const threads: InboxThread[] = [];
      for (const group of byInvoice.values()) {
        const sent = group.filter((r) => r.m.status === "sent");
        if (sent.length === 0) continue;
        const last = sent[sent.length - 1]!;
        const lastIn = [...sent].reverse().find((r) => r.m.direction === "in" && r.m.classification);
        const { invoice } = last;
        threads.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          invoiceStatus: invoice.status,
          amountUsdc: invoice.amountUsdc,
          buyerId: invoice.buyerId,
          buyerName: last.buyerName,
          last: { direction: last.m.direction, channel: last.m.channel, body: last.m.body, createdAt: last.m.createdAt.toISOString() },
          lastIntent: lastIn?.m.classification ? { intent: lastIn.m.classification.intent as ReplyIntent, confidence: lastIn.m.classification.confidence } : undefined,
          needsReply: last.m.direction === "in",
          hasDraft: group.some((r) => r.m.status === "draft"),
          count: sent.length,
        });
      }
      threads.sort((x, y) => y.last.createdAt.localeCompare(x.last.createdAt));
      if (filter.view === "needs_reply") return threads.filter((t) => t.needsReply);
      if (filter.view === "disputed") return threads.filter((t) => t.invoiceStatus === "disputed" || t.lastIntent?.intent === "dispute");
      return threads;
    },

    async getThread(exporterId: string, invoiceId: string): Promise<InboxThreadDetail | null> {
      // One round trip: the messages are read alongside the ownership check and dropped unless it passes.
      const [owned, messages, actions] = await Promise.all([
        ownedInvoice(exporterId, invoiceId),
        db.select().from(s.messages).where(and(eq(s.messages.invoiceId, invoiceId), inArray(s.messages.status, ["sent", "draft"]))).orderBy(asc(s.messages.createdAt), asc(s.messages.id)),
        db.select().from(s.agentActions).where(and(eq(s.agentActions.exporterId, exporterId), eq(s.agentActions.invoiceId, invoiceId))).orderBy(desc(s.agentActions.createdAt)),
      ]);
      if (!owned) return null;
      return {
        invoice: toInvoice(owned.invoice, appUrl),
        buyer: toBuyer(owned.buyer),
        messages: messages.map(toThreadMessage),
        actions: actions.map((a) => ({ ...toAction(a), ...(a.approvedBy ? { approvedBy: a.approvedBy } : {}) })),
      };
    },

    /** One waiting draft per invoice: a new draft discards the previous one. */
    async saveDraft(exporterId: string, input: { invoiceId: string; channel: Channel; subject: string; body: string; inReplyTo?: string; at?: Date }): Promise<ThreadMessage> {
      const owned = await ownedInvoice(exporterId, input.invoiceId);
      if (!owned) throw new Error("Invoice not found");
      const [exporter] = await db.select({ name: s.exporters.name }).from(s.exporters).where(eq(s.exporters.id, exporterId));
      return db.transaction(async (tx) => {
        await tx.update(s.messages).set({ status: "discarded" }).where(and(eq(s.messages.invoiceId, input.invoiceId), eq(s.messages.status, "draft")));
        const [row] = await tx
          .insert(s.messages)
          .values({
            id: newId("msg"), invoiceId: input.invoiceId, direction: "out", channel: input.channel, status: "draft",
            from: exporter!.name, subject: input.subject, body: input.body, inReplyTo: input.inReplyTo ?? null, createdAt: input.at ?? new Date(),
          })
          .returning();
        return toThreadMessage(row!);
      });
    },

    async discardDraft(exporterId: string, messageId: string): Promise<boolean> {
      const owned = await ownedMessage(exporterId, messageId);
      if (!owned || owned.m.status !== "draft") return false;
      await db.update(s.messages).set({ status: "discarded" }).where(and(eq(s.messages.id, messageId), eq(s.messages.status, "draft")));
      return true;
    },

    /** Approve & send (E3): the draft becomes a sent message and the send is logged with rule id + approver. Null if not a waiting draft. */
    async sendDraft(exporterId: string, messageId: string, input: SendInput): Promise<{ message: ThreadMessage; action: AgentAction & { approvedBy: string } } | null> {
      const owned = await ownedMessage(exporterId, messageId);
      if (!owned || owned.m.status !== "draft") return null;
      const at = input.at ?? new Date();
      return db.transaction(async (tx) => {
        const [m] = await tx
          .update(s.messages)
          .set({ status: "sent", body: input.body, createdAt: at })
          .where(and(eq(s.messages.id, messageId), eq(s.messages.status, "draft")))
          .returning();
        if (!m) return null;
        const [inv] = await tx.select({ number: s.invoices.number }).from(s.invoices).where(eq(s.invoices.id, m.invoiceId));
        const [a] = await tx
          .insert(s.agentActions)
          .values({
            id: newId("act"), exporterId, buyerId: owned.buyerId, invoiceId: m.invoiceId, kind: "reply", status: "executed",
            inputSummary: `Reply on ${inv!.number} via ${m.channel === "pay_page" ? "the pay page" : "email"}`,
            decision: input.decision, reason: input.reason, confidence: input.confidence, ruleId: input.ruleId, approvedBy: input.approvedBy, createdAt: at,
          })
          .returning();
        return { message: toThreadMessage(m), action: { ...toAction(a!), approvedBy: input.approvedBy } };
      });
    },

    async getContactEmail(exporterId: string): Promise<string | null> {
      const [r] = await db.select({ email: s.exporters.contactEmail }).from(s.exporters).where(eq(s.exporters.id, exporterId));
      return r?.email.trim() || null; // "" = not set (column default)
    },
  };
}

export type InboxStore = ReturnType<typeof createInboxStore>;
