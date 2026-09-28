import { describe, expect, it } from "vitest";
import type { ReplyClassification, ReplyClassifier } from "./classifier";
import { draftReplyFor, handleInbound, sendReply, type InboxPort, type PortMessage } from "./inbox";
import type { Mailer } from "./mailer";
import { DEFAULT_RULEBOOK } from "./rulebook";
import { fakeAnthropic, promptText } from "./testing/fake-anthropic";
import { EXPORTER_NAME, HARBOURLINE, HARBOURLINE_INVOICES, MERIDIAN_SECRETS } from "./testing/buyers";

const NOW = new Date("2026-09-28T02:00:00Z");
const E = "exp_teratai";
const INV = HARBOURLINE_INVOICES[0]!;

/** In-memory stand-in for @kutip/db's store + inbox store, recording every write. */
function fakePort(opts: { status?: string; replies?: unknown; channel?: PortMessage["channel"]; body?: string } = {}) {
  const messages: PortMessage[] = [
    { id: "msg_in", invoiceId: INV.id, direction: "in", channel: opts.channel ?? "pay_page", status: "sent", from: HARBOURLINE.contactName, subject: "Message from the pay page", body: opts.body ?? "Can you resend the invoice?", createdAt: "2026-09-28T01:59:00.000Z" },
  ];
  const writes: Array<[string, ...unknown[]]> = [];
  const invoice = { ...INV, status: (opts.status ?? "overdue") as never };
  const port: InboxPort = {
    async getThread(e, id) {
      if (e !== E || id !== INV.id) return null;
      return { invoice, buyer: HARBOURLINE, messages: messages.filter((m) => m.status !== "discarded") };
    },
    async getBuyerContext(e, buyerId) {
      if (e !== E || buyerId !== HARBOURLINE.id) return null;
      return { exporterName: EXPORTER_NAME, buyer: HARBOURLINE, invoices: [invoice], messages: [] };
    },
    async getRulebook() {
      return { ...DEFAULT_RULEBOOK, ...(opts.replies ? { replies: { ...DEFAULT_RULEBOOK.replies, ...(opts.replies as object) } } : {}) };
    },
    async setClassification(id, c) {
      writes.push(["setClassification", id, c]);
      const m = messages.find((x) => x.id === id);
      if (m) m.classification = c;
    },
    async setPromisedDate(...a) { writes.push(["setPromisedDate", ...a]); },
    async setInvoiceStatus(...a) { writes.push(["setInvoiceStatus", ...a]); },
    async recordAgentAction(a) { writes.push(["recordAgentAction", a]); return { id: `act_${writes.length}` }; },
    async saveDraft(_e, d) {
      writes.push(["saveDraft", d]);
      for (const m of messages) if (m.status === "draft") m.status = "discarded";
      const m: PortMessage = { id: `msg_draft_${writes.length}`, direction: "out", status: "draft", from: EXPORTER_NAME, createdAt: NOW.toISOString(), ...d };
      messages.push(m);
      return m;
    },
    async sendDraft(_e, id, input) {
      writes.push(["sendDraft", id, input]);
      const m = messages.find((x) => x.id === id && x.status === "draft");
      if (!m) return null;
      m.status = "sent";
      m.body = input.body;
      return { message: m, action: { id: "act_reply" } };
    },
    async getContactEmail() { return "owner@teratai.test"; },
  };
  return { port, writes, messages };
}

function fakeMailer() {
  const sent: Array<[string, unknown, unknown]> = [];
  const mailer: Mailer = { async send(to, email, o) { sent.push([to, email, o]); return "sent"; } };
  return { mailer, sent };
}

const classifier = (c: ReplyClassification): ReplyClassifier => ({ classifyReply: async () => c });

function anthropic(topic = "resend_invoice", body = "Hi Claire, here is INV-2026-0142 again.") {
  return fakeAnthropic((req) => {
    const schema = JSON.stringify(req.output_config.format.schema);
    if (schema.includes('"topic"')) return { output: { subject: "Re: INV-2026-0142", body, topic } };
    return { output: { decision: "Read the message", reason: "Rule said so" } };
  });
}

describe("handleInbound (E2.1 → M2 → E3)", () => {
  it("default setting: classifies, logs the reading, drafts, and waits for the owner", async () => {
    const { port, writes, messages } = fakePort();
    const { mailer, sent } = fakeMailer();
    const { client } = anthropic();
    const out = await handleInbound({ store: port, classifier: classifier({ label: "question", confidence: 0.95 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_in" });

    expect(out.permission).toMatchObject({ mode: "draft", ruleId: "C7" });
    expect(writes.map((w) => w[0])).toEqual(["setClassification", "saveDraft", "recordAgentAction"]);
    expect(writes[2]![1]).toMatchObject({ kind: "classify_reply", status: "escalated", decision: expect.stringMatching(/drafted a reply for you to approve/) });
    expect(messages.at(-1)).toMatchObject({ status: "draft", channel: "pay_page", inReplyTo: "msg_in" });
    expect(sent).toEqual([]);
  });

  it("routine: a routine pay-page answer goes out, logged with the agent as approver", async () => {
    const { port, writes, messages } = fakePort({ replies: { buyerReplies: "routine" } });
    const { mailer, sent } = fakeMailer();
    const { client } = anthropic("resend_invoice");
    const out = await handleInbound({ store: port, classifier: classifier({ label: "question", confidence: 0.95 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_in" });
    expect(out.permission.mode).toBe("auto");
    expect(out.sent).toBe(true);
    expect(writes.find((w) => w[0] === "sendDraft")![2]).toMatchObject({ approvedBy: "agent", ruleId: "C7" });
    expect(writes.find((w) => w[0] === "recordAgentAction")![1]).toMatchObject({ status: "executed", decision: expect.stringMatching(/answered it automatically/) });
    expect(messages.at(-1)).toMatchObject({ status: "sent" });
    expect(sent).toEqual([]); // pay-page reply: shown on the page, not emailed
  });

  it("routine never sends a dispute: it's marked disputed and drafted for the owner", async () => {
    const { port, writes } = fakePort({ replies: { buyerReplies: "routine" }, body: "Half the chairs arrived broken" });
    const { mailer, sent } = fakeMailer();
    const { client } = anthropic("resend_invoice", "Hi Claire, sorry to hear that. Our team will look into it and reply personally.");
    const out = await handleInbound({ store: port, classifier: classifier({ label: "dispute", confidence: 0.99 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_in" });
    expect(out.permission).toMatchObject({ mode: "draft", ruleId: "C4" });
    expect(writes.some((w) => w[0] === "sendDraft")).toBe(false);
    expect(writes.find((w) => w[0] === "setInvoiceStatus")).toEqual(["setInvoiceStatus", E, INV.id, "disputed", NOW]);
    expect(sent).toEqual([]);
  });

  it("Off: classifies and logs, drafts nothing", async () => {
    const { port, writes } = fakePort({ replies: { buyerReplies: "off" } });
    const { mailer } = fakeMailer();
    const { client } = anthropic();
    await handleInbound({ store: port, classifier: classifier({ label: "question", confidence: 0.95 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_in" });
    expect(writes.map((w) => w[0])).toEqual(["setClassification", "recordAgentAction"]);
  });

  it("if the drafting model misbehaves, a plain holding draft is saved instead (never auto-sent)", async () => {
    const { port, writes, messages } = fakePort({ replies: { buyerReplies: "routine" } });
    const { mailer } = fakeMailer();
    const { client } = anthropic("resend_invoice", "Pay USD 1.00 and we're square, with a 50% discount.");
    const out = await handleInbound({ store: port, classifier: classifier({ label: "question", confidence: 0.95 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_in" });
    expect(out.permission.mode).toBe("draft");
    expect(messages.at(-1)!.body).toMatch(/Thank you for your message about INV-2026-0142/);
    expect(writes.some((w) => w[0] === "sendDraft")).toBe(false);
  });

  it("every prompt carries only this buyer (L4)", async () => {
    const { port } = fakePort();
    const { mailer } = fakeMailer();
    const { client, requests } = anthropic();
    await handleInbound({ store: port, classifier: classifier({ label: "question", confidence: 0.95 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_in" });
    expect(requests.length).toBeGreaterThan(0);
    for (const r of requests) for (const secret of MERIDIAN_SECRETS) expect(promptText(r)).not.toContain(secret);
  });

  it("refuses a message id that isn't an inbound message on this invoice", async () => {
    const { port } = fakePort();
    const { mailer } = fakeMailer();
    const { client } = anthropic();
    await expect(handleInbound({ store: port, classifier: classifier({ label: "question", confidence: 0.95 }), client, mailer, now: () => NOW }, { exporterId: E, invoiceId: INV.id, messageId: "msg_other" })).rejects.toThrow(/not found/i);
  });
});

describe("draftReplyFor + sendReply (M2 owner flow)", () => {
  it("drafts on request even when automatic replies are off, then the owner's edit is what gets emailed, with Reply-To", async () => {
    const { port, writes } = fakePort({ replies: { buyerReplies: "off" }, channel: "logged" });
    const { mailer, sent } = fakeMailer();
    const { client } = anthropic("payment_instructions", "Hi Claire, here is how to pay INV-2026-0142.");
    const deps = { store: port, classifier: classifier({ label: "question", confidence: 0.9 }), client, mailer, now: () => NOW };
    const draft = await draftReplyFor(deps, { exporterId: E, invoiceId: INV.id });
    expect(draft).toMatchObject({ status: "draft", channel: "email" });
    expect(draft.body).toContain(INV.payUrl);

    const r = await sendReply(deps, { exporterId: E, invoiceId: INV.id, draftId: draft.id, body: "Owner's edited text", approvedBy: "usr_owner" });
    expect(r.delivery).toBe("sent");
    expect(sent).toEqual([[HARBOURLINE.email, { subject: "Re: INV-2026-0142", body: "Owner's edited text" }, { replyTo: "owner@teratai.test" }]]);
    expect(writes.find((w) => w[0] === "sendDraft")![2]).toMatchObject({ approvedBy: "usr_owner", body: "Owner's edited text" });
  });

  it("owner-approved dispute replies are logged under the dispute rule", async () => {
    const { port, writes, messages } = fakePort();
    messages[0]!.classification = { intent: "dispute", confidence: 0.97 };
    const { mailer } = fakeMailer();
    const { client } = anthropic("other", "Hi Claire, sorry to hear that. Our team will reply personally.");
    const deps = { store: port, classifier: classifier({ label: "dispute", confidence: 0.97 }), client, mailer, now: () => NOW };
    const draft = await draftReplyFor(deps, { exporterId: E, invoiceId: INV.id });
    await sendReply(deps, { exporterId: E, invoiceId: INV.id, draftId: draft.id, body: draft.body, approvedBy: "usr_owner" });
    expect(writes.find((w) => w[0] === "sendDraft")![2]).toMatchObject({ ruleId: "C4" });
  });

  it("refuses an empty reply and a draft that isn't waiting", async () => {
    const { port } = fakePort();
    const { mailer } = fakeMailer();
    const { client } = anthropic();
    const deps = { store: port, classifier: classifier({ label: "question", confidence: 0.9 }), client, mailer, now: () => NOW };
    await expect(sendReply(deps, { exporterId: E, invoiceId: INV.id, draftId: "msg_in", body: "  ", approvedBy: "usr_owner" })).rejects.toThrow(/empty/i);
    await expect(sendReply(deps, { exporterId: E, invoiceId: INV.id, draftId: "msg_in", body: "hi", approvedBy: "usr_owner" })).rejects.toThrow(/no longer waiting/i);
  });
});
