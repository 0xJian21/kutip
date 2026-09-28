/**
 * An inbound buyer reply (SPEC F8): classify (Jev, falling back to Haiku) → the rules engine
 * decides (decideReply) → message + agent_action rows, promised date or dispute status.
 * Every LLM call gets one buyer's context (SPEC §5 L4). No inbound email channel exists yet;
 * the invoice page's "Simulate buyer reply" drives this for the demo.
 */
import { UserError } from "../data/result";
import { buildBuyerContext, decideReply, type ReplyClassifier, type ReplyDecision } from "@kutip/agent";
import type { Store } from "@kutip/db";

export type ReplyStore = Pick<Store, "getInvoice" | "getBuyerContext" | "getRulebook" | "recordMessage" | "recordAgentAction" | "setPromisedDate" | "setInvoiceStatus">;
type Explain = (ctx: ReturnType<typeof buildBuyerContext>, req: { kind: "classify_reply"; decision: ReplyDecision; facts: string[] }) => Promise<{ decision: string; reason: string }>;

const LABEL: Record<string, string> = {
  will_pay_on_date: "a promise to pay",
  dispute: "a dispute",
  discount_request: "a discount request",
  claims_paid: "a claim that it's already paid",
  question: "a question",
  other: "nothing actionable",
};

export async function handleBuyerReply(d: {
  store: ReplyStore;
  classifier: ReplyClassifier;
  explain: Explain;
  exporterId: string;
  invoiceId: string;
  subject: string;
  body: string;
  now: Date;
}) {
  const { store, exporterId, invoiceId, now } = d;
  const detail = await store.getInvoice(exporterId, invoiceId);
  if (!detail) throw new UserError("Invoice not found");
  const raw = await store.getBuyerContext(exporterId, detail.buyer.id);
  if (!raw) throw new UserError("Buyer not found");
  const ctx = buildBuyerContext(raw);

  const c = await d.classifier.classifyReply(ctx, { subject: d.subject, body: d.body, receivedAt: now.toISOString() });
  await store.recordMessage({ invoiceId, direction: "in", from: detail.buyer.contactName, subject: d.subject, body: d.body, classification: { intent: c.label, confidence: c.confidence }, at: now });

  const decision = decideReply({ classification: c, now, timezone: detail.buyer.timezone, rulebook: await store.getRulebook(exporterId) });
  if (decision.action === "pause" && decision.promisedDate) await store.setPromisedDate(exporterId, invoiceId, decision.promisedDate);
  if (decision.markDisputed) await store.setInvoiceStatus(exporterId, invoiceId, "disputed", now);

  const facts = [`Invoice ${detail.invoice.number}`, `Reply read as ${LABEL[c.label]} (confidence ${c.confidence.toFixed(2)})`];
  if (c.extracted?.promisedDate) facts.push(`Date in the email: ${c.extracted.promisedDate}`);
  if (c.extracted?.discountText) facts.push(`Discount asked: ${c.extracted.discountText}`);
  const text = await d.explain(ctx, { kind: "classify_reply", decision, facts }).catch(() => ({
    decision: `Read the reply to ${detail.invoice.number} as ${LABEL[c.label]}${decision.allowed ? "" : " and handed it to you"}`,
    reason: decision.reason,
  }));

  const action = await store.recordAgentAction({
    exporterId,
    buyerId: detail.buyer.id,
    invoiceId,
    kind: "classify_reply",
    inputSummary: `Reply to ${detail.invoice.number}: ${c.label} (${c.confidence.toFixed(2)})`,
    decision: text.decision,
    reason: text.reason,
    confidence: c.confidence,
    ruleId: decision.ruleId,
    status: decision.allowed ? "executed" : "escalated",
    at: now,
  });
  return { classification: c, decision, action };
}
