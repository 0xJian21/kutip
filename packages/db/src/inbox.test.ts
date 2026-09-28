import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { Db } from "./client";
import { createInboxStore, PAY_MESSAGE_MAX_CHARS, PAY_MESSAGES_PER_HOUR, type InboxStore } from "./inbox";
import type { Store } from "./store";
import { ref, setup } from "./testing/fixtures";
import type { Buyer, Invoice } from "./types";

let db: Db;
let store: Store;
let inbox: InboxStore;
let exporterId: string;
let a: Buyer;
let b: Buyer;

beforeEach(async () => {
  ({ db, store, exporterId, a, b } = await setup());
  inbox = createInboxStore(db);
});

async function invoiceFor(buyer: Buyer, status: "sent" | "draft" = "sent"): Promise<Invoice> {
  return store.createInvoice({
    exporterId, buyerId: buyer.id, issuedAt: "2026-09-20", dueDate: "2026-10-04", referencePubkey: ref(), status,
    lineItems: [{ description: `Teak chairs for ${buyer.name}`, quantity: 2, unitPriceUsdc: 125_000_000n }],
  });
}

const at = (iso: string) => new Date(iso);

describe("pay-page messages (E2.1)", () => {
  test("a buyer message lands as an inbound pay_page message for that invoice only", async () => {
    const inv = await invoiceFor(a);
    const r = await inbox.postPayMessage(inv.id, "  Can you resend the invoice as PDF?  ", { now: at("2026-09-28T02:00:00Z") });
    expect(r).toMatchObject({ ok: true, exporterId, buyerId: a.id, invoiceId: inv.id });

    const thread = await inbox.getThread(exporterId, inv.id);
    expect(thread?.messages).toEqual([
      expect.objectContaining({ direction: "in", channel: "pay_page", status: "sent", body: "Can you resend the invoice as PDF?", from: a.contactName }),
    ]);
  });

  test("empty, too long, unknown and draft invoices are refused", async () => {
    const inv = await invoiceFor(a);
    const draft = await invoiceFor(a, "draft");
    expect(await inbox.postPayMessage(inv.id, "   ")).toEqual({ ok: false, error: "empty" });
    expect(await inbox.postPayMessage(inv.id, "x".repeat(PAY_MESSAGE_MAX_CHARS + 1))).toEqual({ ok: false, error: "too_long" });
    expect(await inbox.postPayMessage("inv_doesnotexist", "hello")).toEqual({ ok: false, error: "not_found" });
    expect(await inbox.postPayMessage(draft.id, "hello")).toEqual({ ok: false, error: "not_found" });
  });

  test("rate-limited per invoice per hour", async () => {
    const inv = await invoiceFor(a);
    const now = at("2026-09-28T02:00:00Z");
    for (let i = 0; i < PAY_MESSAGES_PER_HOUR; i++) expect((await inbox.postPayMessage(inv.id, `q${i}`, { now })).ok).toBe(true);
    expect(await inbox.postPayMessage(inv.id, "one more", { now })).toEqual({ ok: false, error: "rate_limited" });
    // An hour later the window has moved on.
    expect((await inbox.postPayMessage(inv.id, "later", { now: at("2026-09-28T03:00:01Z") })).ok).toBe(true);
  });

  test("leak test: the pay thread shows only this invoice's pay-page conversation, never drafts, emails or other invoices", async () => {
    const mine = await invoiceFor(a);
    const sibling = await invoiceFor(a); // same buyer, other invoice
    const other = await invoiceFor(b); // other buyer

    await inbox.postPayMessage(mine.id, "Question about mine", { now: at("2026-09-28T01:00:00Z") });
    await inbox.postPayMessage(sibling.id, "SIBLING-SECRET question", { now: at("2026-09-28T01:00:00Z") });
    await inbox.postPayMessage(other.id, "MERIDIAN-SECRET question", { now: at("2026-09-28T01:00:00Z") });
    await store.recordMessage({ invoiceId: mine.id, direction: "out", from: "Teratai", subject: "Reminder", body: "EMAIL-ONLY reminder text" });
    const draft = await inbox.saveDraft(exporterId, { invoiceId: mine.id, channel: "pay_page", subject: "Re", body: "DRAFT-NOT-APPROVED" });
    const draft2 = await inbox.saveDraft(exporterId, { invoiceId: other.id, channel: "pay_page", subject: "Re", body: "MERIDIAN-REPLY" });
    await inbox.sendDraft(exporterId, draft2.id, { body: "MERIDIAN-REPLY", approvedBy: "usr_owner", ruleId: "C7", decision: "d", reason: "r", confidence: 1 });

    const thread = await inbox.getPayThread(mine.id);
    const text = JSON.stringify(thread);
    expect(thread).toEqual([expect.objectContaining({ from: "buyer", body: "Question about mine" })]);
    for (const secret of ["SIBLING-SECRET", "MERIDIAN-SECRET", "MERIDIAN-REPLY", "EMAIL-ONLY", "DRAFT-NOT-APPROVED", a.email, a.id, exporterId]) {
      expect(text, `pay thread leaked "${secret}"`).not.toContain(secret);
    }
    // Only public fields.
    expect(Object.keys(thread![0]!).sort()).toEqual(["body", "createdAt", "from", "id"]);

    // Once approved, the reply appears.
    await inbox.sendDraft(exporterId, draft.id, { body: "Approved answer", approvedBy: "usr_owner", ruleId: "C7", decision: "d", reason: "r", confidence: 1 });
    expect((await inbox.getPayThread(mine.id))!.map((m) => [m.from, m.body])).toEqual([["buyer", "Question about mine"], ["seller", "Approved answer"]]);
  });

  test("unknown or draft invoices have no pay thread", async () => {
    expect(await inbox.getPayThread("inv_nope")).toBeNull();
    expect(await inbox.getPayThread((await invoiceFor(a, "draft")).id)).toBeNull();
  });
});

describe("drafts and approvals (M2/E3)", () => {
  test("a draft is not a sent message: invoice detail, buyer context and reminder counts ignore it", async () => {
    const inv = await invoiceFor(a);
    await inbox.saveDraft(exporterId, { invoiceId: inv.id, channel: "email", subject: "Re: invoice", body: "Draft body" });
    expect((await store.getInvoice(exporterId, inv.id))!.messages).toEqual([]);
    expect((await store.getBuyerContext(exporterId, a.id))!.messages).toEqual([]);
  });

  test("a new draft replaces the previous one for the same invoice", async () => {
    const inv = await invoiceFor(a);
    await inbox.saveDraft(exporterId, { invoiceId: inv.id, channel: "email", subject: "s", body: "first" });
    await inbox.saveDraft(exporterId, { invoiceId: inv.id, channel: "email", subject: "s", body: "second" });
    const t = await inbox.getThread(exporterId, inv.id);
    expect(t!.messages.map((m) => [m.status, m.body])).toEqual([["draft", "second"]]);
  });

  test("sending a draft marks it sent with the edited body and logs a reply action with rule id and approver", async () => {
    const inv = await invoiceFor(a);
    const inbound = await inbox.postPayMessage(inv.id, "How do I pay?", { now: at("2026-09-28T01:00:00Z") });
    const draft = await inbox.saveDraft(exporterId, {
      invoiceId: inv.id, channel: "pay_page", subject: "Re: how to pay", body: "agent text", inReplyTo: inbound.ok ? inbound.messageId : undefined,
    });
    const sent = await inbox.sendDraft(exporterId, draft.id, {
      body: "owner edited text", approvedBy: "usr_owner", ruleId: "C7", decision: "Sent the reply", reason: "Owner approved", confidence: 0.9, at: at("2026-09-28T02:00:00Z"),
    });
    expect(sent!.message).toMatchObject({ status: "sent", body: "owner edited text", createdAt: "2026-09-28T02:00:00.000Z" });
    expect(sent!.action).toMatchObject({ kind: "reply", status: "executed", ruleId: "C7", invoiceId: inv.id, buyerId: a.id, approvedBy: "usr_owner" });
    const row = (await db.execute(sql`select approved_by from agent_actions where id = ${sent!.action.id}`)) as unknown as { rows: Array<{ approved_by: string }> };
    expect(row.rows[0]!.approved_by).toBe("usr_owner");

    // Sending twice does nothing the second time.
    expect(await inbox.sendDraft(exporterId, draft.id, { body: "again", approvedBy: "usr_owner", ruleId: "C7", decision: "d", reason: "r", confidence: 1 })).toBeNull();
  });

  test("another exporter can't send, discard or read a thread", async () => {
    const inv = await invoiceFor(a);
    const draft = await inbox.saveDraft(exporterId, { invoiceId: inv.id, channel: "email", subject: "s", body: "b" });
    expect(await inbox.getThread("exp_other", inv.id)).toBeNull();
    expect(await inbox.discardDraft("exp_other", draft.id)).toBe(false);
    expect(await inbox.sendDraft("exp_other", draft.id, { body: "b", approvedBy: "x", ruleId: "C7", decision: "d", reason: "r", confidence: 1 })).toBeNull();
    await expect(inbox.saveDraft("exp_other", { invoiceId: inv.id, channel: "email", subject: "s", body: "b" })).rejects.toThrow();
    await expect(inbox.logBuyerMessage("exp_other", { invoiceId: inv.id, body: "b" })).rejects.toThrow();
    expect(await inbox.discardDraft(exporterId, draft.id)).toBe(true);
    expect((await inbox.getThread(exporterId, inv.id))!.messages).toEqual([]);
  });
});

describe("unified inbox (M1)", () => {
  test("one thread per invoice, newest first, with needs-reply and disputed filters", async () => {
    const i1 = await invoiceFor(a);
    const i2 = await invoiceFor(b);
    const i3 = await invoiceFor(a);
    await store.recordMessage({ invoiceId: i1.id, direction: "out", from: "Teratai", subject: "Invoice", body: "Here it is", at: at("2026-09-27T01:00:00Z") });
    await inbox.logBuyerMessage(exporterId, { invoiceId: i1.id, body: "Pasted WhatsApp: will pay Friday", at: at("2026-09-27T02:00:00Z") });
    await inbox.postPayMessage(i2.id, "The chairs arrived damaged", { now: at("2026-09-27T03:00:00Z") });
    await store.setInvoiceStatus(exporterId, i2.id, "disputed");
    await store.recordMessage({ invoiceId: i3.id, direction: "out", from: "Teratai", subject: "Invoice", body: "Sent", at: at("2026-09-27T04:00:00Z") });

    const all = await inbox.listThreads(exporterId);
    expect(all.map((t) => t.invoiceId)).toEqual([i3.id, i2.id, i1.id]);
    expect(all.find((t) => t.invoiceId === i1.id)).toMatchObject({ buyerName: a.name, needsReply: true, count: 2, last: { channel: "logged", direction: "in" } });
    expect(all.find((t) => t.invoiceId === i3.id)).toMatchObject({ needsReply: false });

    expect((await inbox.listThreads(exporterId, { view: "needs_reply" })).map((t) => t.invoiceId).sort()).toEqual([i1.id, i2.id].sort());
    expect((await inbox.listThreads(exporterId, { view: "disputed" })).map((t) => t.invoiceId)).toEqual([i2.id]);
    expect((await inbox.listThreads(exporterId, { buyerId: a.id })).map((t) => t.invoiceId)).toEqual([i3.id, i1.id]);
    expect(await inbox.listThreads("exp_other")).toEqual([]);
  });

  test("a waiting draft is flagged on the thread", async () => {
    const inv = await invoiceFor(a);
    await inbox.postPayMessage(inv.id, "Question", { now: at("2026-09-27T03:00:00Z") });
    await inbox.saveDraft(exporterId, { invoiceId: inv.id, channel: "pay_page", subject: "Re", body: "Answer", at: at("2026-09-27T03:01:00Z") });
    const [t] = await inbox.listThreads(exporterId);
    expect(t).toMatchObject({ hasDraft: true, needsReply: true, last: { direction: "in" } });
  });

  test("classification is stored on the inbound message", async () => {
    const inv = await invoiceFor(a);
    const r = await inbox.postPayMessage(inv.id, "We paid yesterday");
    if (!r.ok) throw new Error("post failed");
    await inbox.setClassification(r.messageId, { intent: "claims_paid", confidence: 0.93 });
    const [t] = await inbox.listThreads(exporterId);
    expect(t!.lastIntent).toEqual({ intent: "claims_paid", confidence: 0.93 });
  });

  test("Reply-To address is the exporter's contact email", async () => {
    expect(await inbox.getContactEmail(exporterId)).toBeNull();
    await db.execute(sql`update exporters set contact_email = 'owner@teratai.test' where id = ${exporterId}`);
    expect(await inbox.getContactEmail(exporterId)).toBe("owner@teratai.test");
  });
});

describe("broadcasts", () => {
  test("a new message pokes invoice:<id> and owner:<exporterId> without content", async () => {
    const inv = await invoiceFor(a);
    await db.execute(sql`delete from realtime.sent`);
    await inbox.postPayMessage(inv.id, "SECRET-BODY");
    const r = (await db.execute(sql`select topic, event, payload from realtime.sent order by id`)) as unknown as { rows: Array<{ topic: string; event: string; payload: unknown }> };
    expect(r.rows).toEqual([
      { topic: `invoice:${inv.id}`, event: "message", payload: {} },
      { topic: `owner:${exporterId}`, event: "changed", payload: { table: "messages" } },
    ]);
  });
});
