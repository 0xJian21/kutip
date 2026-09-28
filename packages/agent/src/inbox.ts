/**
 * Buyer messages end to end (IMPROVEMENTS E2, M2, E3): classify (Jev → Haiku) → the rules engine decides
 * (decideReply) → Haiku drafts a reply from code facts → replyPermission says auto / draft / none.
 * Only a routine answer under "automatic_routine" is sent without the owner; everything else waits as a draft.
 * Every LLM call gets ONE buyer's context (SPEC §5 L4). The store is a port so this stays DB-free.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { ReplyClassifier, ReplyLabel } from "./classifier";
import { buildBuyerContext, type BuyerRecord, type InvoiceRecord, type MessageRecord } from "./context";
import type { Mailer } from "./mailer";
import type { Rulebook } from "./rulebook";
import type { InvoiceStatus, RuleId } from "./rules/decision";
import { decideReply, type ReplyDecision } from "./rules/replies";
import { parseReplySettings, replyPermission, type ReplyPermission } from "./rules/reply-permission";
import { writeReply } from "./writer";

export type PortMessage = {
  id: string;
  invoiceId: string;
  direction: "out" | "in";
  channel: "email" | "pay_page" | "logged";
  status: "draft" | "sent" | "discarded";
  from: string;
  subject: string;
  body: string;
  classification?: { intent: ReplyLabel; confidence: number };
  inReplyTo?: string;
  createdAt: string;
};

type Draft = { invoiceId: string; channel: PortMessage["channel"]; subject: string; body: string; inReplyTo?: string; at?: Date };
type Send = { body: string; approvedBy: string; ruleId: string; decision: string; reason: string; confidence: number; at?: Date };

/** The slice of @kutip/db's Store + InboxStore this needs. */
export type InboxPort = {
  getThread(exporterId: string, invoiceId: string): Promise<{ invoice: InvoiceRecord & { status: InvoiceStatus }; buyer: BuyerRecord & { email: string }; messages: PortMessage[] } | null>;
  getBuyerContext(exporterId: string, buyerId: string): Promise<{ exporterName: string; buyer: BuyerRecord; invoices: InvoiceRecord[]; messages: MessageRecord[] } | null>;
  getRulebook(exporterId: string): Promise<Rulebook & { replies?: unknown }>;
  setClassification(messageId: string, c: { intent: ReplyLabel; confidence: number }): Promise<void>;
  setPromisedDate(exporterId: string, invoiceId: string, date: string | null): Promise<void>;
  setInvoiceStatus(exporterId: string, invoiceId: string, status: "disputed", at: Date): Promise<unknown>;
  recordAgentAction(a: {
    exporterId: string; buyerId?: string; invoiceId?: string; kind: "classify_reply"; inputSummary: string; decision: string; reason: string;
    confidence: number; ruleId: string; status: "executed" | "escalated"; at?: Date;
  }): Promise<{ id: string }>;
  saveDraft(exporterId: string, d: Draft): Promise<PortMessage>;
  sendDraft(exporterId: string, messageId: string, s: Send): Promise<{ message: PortMessage; action: { id: string } } | null>;
  getContactEmail(exporterId: string): Promise<string | null>;
};

export type InboxDeps = { store: InboxPort; classifier: ReplyClassifier; client: Anthropic; mailer: Mailer; now: () => Date; log?: (msg: string) => void };

const LABEL: Record<ReplyLabel, string> = {
  will_pay_on_date: "a promise to pay",
  dispute: "a dispute",
  discount_request: "a discount request",
  claims_paid: "a claim that it's already paid",
  question: "a question",
  other: "nothing actionable",
};

/** The rule a sent reply is logged under: the rule that kept it from being routine, else C7. */
const REPLY_RULE: Partial<Record<ReplyLabel, RuleId>> = { dispute: "C4", discount_request: "C3", will_pay_on_date: "C5" };

async function load(deps: InboxDeps, exporterId: string, invoiceId: string) {
  const thread = await deps.store.getThread(exporterId, invoiceId);
  if (!thread) throw new Error("Invoice not found");
  const raw = await deps.store.getBuyerContext(exporterId, thread.invoice.buyerId);
  if (!raw) throw new Error("Buyer not found");
  return { thread, ctx: buildBuyerContext(raw) };
}

async function draftFor(deps: InboxDeps, loaded: Awaited<ReturnType<typeof load>>, exporterId: string, inbound: PortMessage | undefined) {
  const { thread, ctx } = loaded;
  const channel = inbound?.channel === "pay_page" ? "pay_page" : "email";
  const now = deps.now();
  const written = await writeReply(deps.client, ctx, {
    invoiceId: thread.invoice.id,
    message: { body: inbound?.body ?? "(no message; the seller is writing first)", receivedAt: inbound?.createdAt ?? now.toISOString() },
    channel,
    now,
  }).catch((e: Error) => {
    deps.log?.(`reply draft for ${thread.invoice.number} fell back to the holding text: ${e.message}`);
    // Holding reply: no facts, no promises. Never routine (topic "other").
    return {
      subject: `Re: ${thread.invoice.number}`,
      body: `Hi ${thread.buyer.contactName.split(/\s+/)[0]},\n\nThank you for your message about ${thread.invoice.number}. We'll get back to you shortly.\n\n${ctx.exporterName}`,
      topic: "other" as const,
    };
  });
  const draft = await deps.store.saveDraft(exporterId, { invoiceId: thread.invoice.id, channel, subject: written.subject, body: written.body, inReplyTo: inbound?.id, at: now });
  return { draft, topic: written.topic };
}

async function deliver(deps: InboxDeps, exporterId: string, thread: NonNullable<Awaited<ReturnType<InboxPort["getThread"]>>>, draft: PortMessage, send: Send) {
  const sent = await deps.store.sendDraft(exporterId, draft.id, send);
  if (!sent) throw new Error("This draft is no longer waiting to be sent");
  // Pay-page replies show on the pay page; everything else is emailed, Reply-To the exporter.
  const delivery =
    draft.channel === "pay_page"
      ? ("shown" as const)
      : await deps.mailer.send(thread.buyer.email, { subject: draft.subject, body: send.body }, { replyTo: (await deps.store.getContactEmail(exporterId)) ?? undefined });
  return { action: sent.action, delivery };
}

/** A buyer message just arrived (pay page, or pasted by the owner). */
export async function handleInbound(deps: InboxDeps, req: { exporterId: string; invoiceId: string; messageId: string }) {
  const { exporterId, invoiceId } = req;
  const loaded = await load(deps, exporterId, invoiceId);
  const { thread, ctx } = loaded;
  const inbound = thread.messages.find((m) => m.id === req.messageId && m.direction === "in");
  if (!inbound) throw new Error("Message not found");
  const now = deps.now();

  const c = await deps.classifier.classifyReply(ctx, { subject: inbound.subject, body: inbound.body, receivedAt: inbound.createdAt });
  await deps.store.setClassification(inbound.id, { intent: c.label, confidence: c.confidence });

  const rulebook = await deps.store.getRulebook(exporterId);
  const decision: ReplyDecision = decideReply({ classification: c, now, timezone: thread.buyer.timezone, rulebook });
  if (decision.action === "pause" && decision.promisedDate) await deps.store.setPromisedDate(exporterId, invoiceId, decision.promisedDate);
  if (decision.markDisputed) await deps.store.setInvoiceStatus(exporterId, invoiceId, "disputed", now);

  const settings = parseReplySettings(rulebook.replies);
  // The log line is written in code, not by a model, and after the outcome is known: it says exactly what happened.
  const logReading = (outcome: string, handled: boolean) =>
    deps.store.recordAgentAction({
      exporterId, buyerId: thread.invoice.buyerId, invoiceId, kind: "classify_reply",
      inputSummary: `Message on ${thread.invoice.number}: ${c.label} (${c.confidence.toFixed(2)})`,
      decision: `Read the message on ${thread.invoice.number} as ${LABEL[c.label]} and ${outcome}`,
      reason: decision.reason, confidence: c.confidence, ruleId: decision.ruleId,
      status: handled ? "executed" : "escalated", at: now,
    });

  const off = replyPermission({ settings, classification: c, decision, topic: "other", invoiceStatus: thread.invoice.status });
  if (off.mode === "none") {
    await logReading("left the reply to you", decision.allowed);
    return { classification: c, decision, permission: off, sent: false };
  }

  const { draft, topic } = await draftFor(deps, loaded, exporterId, inbound);
  const permission: ReplyPermission = replyPermission({ settings, classification: c, decision, topic, invoiceStatus: thread.invoice.status });
  if (permission.mode !== "auto") {
    await logReading("drafted a reply for you to approve", decision.allowed);
    return { classification: c, decision, permission, draftId: draft.id, sent: false };
  }

  await logReading("answered it automatically (routine)", true);
  await deliver(deps, exporterId, thread, draft, {
    body: draft.body, approvedBy: "agent", ruleId: permission.ruleId, confidence: c.confidence, at: now,
    decision: `Answered ${thread.invoice.number} automatically`, reason: permission.reason,
  });
  return { classification: c, decision, permission, draftId: draft.id, sent: true };
}

/** M2 "Draft reply": the owner asked, so it drafts whatever the automatic setting says. */
export async function draftReplyFor(deps: InboxDeps, req: { exporterId: string; invoiceId: string }): Promise<PortMessage> {
  const loaded = await load(deps, req.exporterId, req.invoiceId);
  const lastIn = [...loaded.thread.messages].reverse().find((m) => m.direction === "in" && m.status === "sent");
  return (await draftFor(deps, loaded, req.exporterId, lastIn)).draft;
}

/** M2 "Approve & send": the owner's (possibly edited) text goes out and is logged with rule id + approver (E3). */
export async function sendReply(deps: InboxDeps, req: { exporterId: string; invoiceId: string; draftId: string; body: string; approvedBy: string }) {
  const body = req.body.trim();
  if (!body) throw new Error("The reply is empty");
  if (body.length > 4000) throw new Error("Keep the reply under 4,000 characters");
  const { thread } = await load(deps, req.exporterId, req.invoiceId);
  const draft = thread.messages.find((m) => m.id === req.draftId && m.status === "draft");
  if (!draft) throw new Error("This draft is no longer waiting to be sent");
  const answered = thread.messages.find((m) => m.id === draft.inReplyTo);
  const intent = answered?.classification?.intent;
  return deliver(deps, req.exporterId, thread, draft, {
    body, approvedBy: req.approvedBy, ruleId: (intent && REPLY_RULE[intent]) ?? "C7", confidence: 1, at: deps.now(),
    decision: `Sent your approved reply on ${thread.invoice.number}`,
    reason: intent ? `You approved the reply to ${LABEL[intent]}` : "You approved the reply",
  });
}
