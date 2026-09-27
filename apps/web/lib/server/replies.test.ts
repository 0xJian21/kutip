import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RULEBOOK, type ReplyClassification } from "@kutip/agent";
import { handleBuyerReply, type ReplyStore } from "./replies";

const buyer = { id: "b1", name: "Harbourline", contactName: "Sam", email: "sam@harbourline.example", timezone: "Australia/Sydney" };
const invoice = { id: "inv_1", number: "INV-2026-0154", buyerId: "b1", status: "sent" };

function fakeStore() {
  return {
    getInvoice: vi.fn(async () => ({ invoice, buyer })),
    getBuyerContext: vi.fn(async () => ({ exporterName: "Teratai", buyer: { ...buyer, country: "AU", countryName: "Australia", city: "Sydney", multisig: "", vault: "", usdcAta: "" }, invoices: [], messages: [], actions: [] })),
    getRulebook: vi.fn(async () => DEFAULT_RULEBOOK),
    recordMessage: vi.fn(async () => ({})),
    recordAgentAction: vi.fn(async (a: { status: string }) => ({ id: "act_1", ...a })),
    setPromisedDate: vi.fn(async () => {}),
    setInvoiceStatus: vi.fn(async () => ({})),
  };
}

const now = new Date("2026-09-30T02:00:00Z");
const explain = async () => ({ decision: "d", reason: "r" });
const run = (store: ReturnType<typeof fakeStore>, c: ReplyClassification) =>
  handleBuyerReply({ store: store as unknown as ReplyStore, classifier: { classifyReply: async () => c }, explain, exporterId: "exp", invoiceId: "inv_1", subject: "Re: invoice", body: "text", now });

describe("handleBuyerReply", () => {
  it("records the inbound message with its classification", async () => {
    const store = fakeStore();
    await run(store, { label: "question", confidence: 0.9 });
    expect(store.recordMessage).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "inv_1", direction: "in", from: "Sam", classification: { intent: "question", confidence: 0.9 } }));
  });

  it("a dated promise within 7 days pauses reminders (C5) and stores the date", async () => {
    const store = fakeStore();
    const out = await run(store, { label: "will_pay_on_date", confidence: 0.95, extracted: { promisedDate: "2026-10-03" } });
    expect(store.setPromisedDate).toHaveBeenCalledWith("exp", "inv_1", "2026-10-03");
    expect(store.recordAgentAction).toHaveBeenCalledWith(expect.objectContaining({ kind: "classify_reply", ruleId: "C5", status: "executed", confidence: 0.95, buyerId: "b1", invoiceId: "inv_1" }));
    expect(out.decision.action).toBe("pause");
  });

  it("a dispute marks the invoice disputed and escalates (C4)", async () => {
    const store = fakeStore();
    await run(store, { label: "dispute", confidence: 0.9 });
    expect(store.setInvoiceStatus).toHaveBeenCalledWith("exp", "inv_1", "disputed", now);
    expect(store.recordAgentAction).toHaveBeenCalledWith(expect.objectContaining({ ruleId: "C4", status: "escalated" }));
  });

  it("low confidence escalates without touching the invoice", async () => {
    const store = fakeStore();
    await run(store, { label: "will_pay_on_date", confidence: 0.4, extracted: { promisedDate: "2026-10-03" } });
    expect(store.setPromisedDate).not.toHaveBeenCalled();
    expect(store.recordAgentAction).toHaveBeenCalledWith(expect.objectContaining({ status: "escalated" }));
  });

  it("falls back to the rule's own reason when the explanation fails", async () => {
    const store = fakeStore();
    await handleBuyerReply({
      store: store as unknown as ReplyStore, classifier: { classifyReply: async () => ({ label: "claims_paid", confidence: 0.9 }) },
      explain: async () => { throw new Error("haiku down"); }, exporterId: "exp", invoiceId: "inv_1", subject: "s", body: "b", now,
    });
    expect(store.recordAgentAction).toHaveBeenCalledWith(expect.objectContaining({ reason: "The buyer says they paid but no matching payment has been seen" }));
  });
});
