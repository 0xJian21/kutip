"use server";

/**
 * Unified inbox (IMPROVEMENTS M1, M2, E2.3): server actions scoped to the signed-in exporter.
 * The owner sees every thread; each agent call inside stays scoped to one buyer (L4).
 */
import { draftReplyFor, handleInbound, InputError, sendReply } from "@kutip/agent";
import { after } from "next/server";
import { inbox, inboxDeps } from "@/app/api/agent/_lib/deps";
import { MOCK, sessionOrThrow, writeSessionOrThrow } from "@/lib/server/auth";
import { llmBudget } from "@/lib/server/llm-budget";
import { toResult, UserError } from "@/lib/data/result";

/** Messages written for the owner (InputError from @kutip/agent, UserError here) reach the browser; the rest is masked. */
function run<T>(fn: () => Promise<T>) {
  return toResult(() => fn().catch((e: unknown) => {
    throw e instanceof InputError ? new UserError(e.message) : e;
  }));
}

/** `write` refuses DEMO_FALLBACK visitors (read-only role). */
async function owner(opts: { write?: boolean } = {}) {
  const s = await (opts.write ? writeSessionOrThrow() : sessionOrThrow());
  if (MOCK) throw new UserError("The inbox needs the real database (NEXT_PUBLIC_KUTIP_MOCK is on)");
  return s;
}

export async function fetchThreads(filter: { buyerId?: string; view?: "all" | "needs_reply" | "disputed" } = {}) {
  return run(async () => inbox().listThreads((await owner()).exporterId, filter));
}

export async function fetchThread(invoiceId: string) {
  return run(async () => {
    const t = await inbox().getThread((await owner()).exporterId, invoiceId);
    if (!t) throw new UserError("Thread not found");
    return t;
  });
}

/** M2 "Draft reply": Haiku drafts from code facts; nothing is sent. */
export async function draftReply(invoiceId: string) {
  return run(async () => {
    const { exporterId } = await owner({ write: true }); // stores a draft
    llmBudget.spend(exporterId);
    return draftReplyFor(inboxDeps(), { exporterId, invoiceId });
  });
}

/** M2 "Approve & send": the owner's text goes out, logged with rule id + approver (E3). */
export async function approveAndSend(input: { invoiceId: string; draftId: string; body: string }) {
  return run(async () => {
    const s = await owner({ write: true });
    const r = await sendReply(inboxDeps(), { exporterId: s.exporterId, invoiceId: input.invoiceId, draftId: input.draftId, body: input.body, approvedBy: s.privyUserId });
    return { delivery: r.delivery };
  });
}

export async function discardDraft(draftId: string) {
  return run(async () => inbox().discardDraft((await owner({ write: true })).exporterId, draftId));
}

/** E2.3: paste a message the buyer sent by email or WhatsApp; the agent reads it like any other. */
export async function logBuyerMessage(input: { invoiceId: string; body: string }) {
  return run(async () => {
    const { exporterId } = await owner({ write: true });
    if (!input.body.trim()) throw new UserError("Paste the buyer's message first");
    llmBudget.spend(exporterId);
    const m = await inbox().logBuyerMessage(exporterId, { invoiceId: input.invoiceId, body: input.body });
    after(() => handleInbound(inboxDeps(), { exporterId, invoiceId: input.invoiceId, messageId: m.id }).catch((e) => console.error(`[inbox] ${m.id}: ${(e as Error).message}`)));
    return m;
  });
}
