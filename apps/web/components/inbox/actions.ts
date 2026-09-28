"use server";

/**
 * Unified inbox (IMPROVEMENTS M1, M2, E2.3): server actions scoped to the signed-in exporter.
 * The owner sees every thread; each agent call inside stays scoped to one buyer (L4).
 */
import { draftReplyFor, handleInbound, sendReply } from "@kutip/agent";
import { after } from "next/server";
import { inbox, inboxDeps } from "@/app/api/agent/_lib/deps";
import { MOCK, sessionOrThrow } from "@/lib/server/auth";
import { toResult } from "@/lib/data/result";

async function owner() {
  const s = await sessionOrThrow();
  if (MOCK) throw new Error("The inbox needs the real database (NEXT_PUBLIC_KUTIP_MOCK is on)");
  return s;
}

export async function fetchThreads(filter: { buyerId?: string; view?: "all" | "needs_reply" | "disputed" } = {}) {
  return toResult(async () => inbox().listThreads((await owner()).exporterId, filter));
}

export async function fetchThread(invoiceId: string) {
  return toResult(async () => {
    const t = await inbox().getThread((await owner()).exporterId, invoiceId);
    if (!t) throw new Error("Thread not found");
    return t;
  });
}

/** M2 "Draft reply": Haiku drafts from code facts; nothing is sent. */
export async function draftReply(invoiceId: string) {
  return toResult(async () => draftReplyFor(inboxDeps(), { exporterId: (await owner()).exporterId, invoiceId }));
}

/** M2 "Approve & send": the owner's text goes out, logged with rule id + approver (E3). */
export async function approveAndSend(input: { invoiceId: string; draftId: string; body: string }) {
  return toResult(async () => {
    const s = await owner();
    const r = await sendReply(inboxDeps(), { exporterId: s.exporterId, invoiceId: input.invoiceId, draftId: input.draftId, body: input.body, approvedBy: s.privyUserId });
    return { delivery: r.delivery };
  });
}

export async function discardDraft(draftId: string) {
  return toResult(async () => inbox().discardDraft((await owner()).exporterId, draftId));
}

/** E2.3: paste a message the buyer sent by email or WhatsApp; the agent reads it like any other. */
export async function logBuyerMessage(input: { invoiceId: string; body: string }) {
  return toResult(async () => {
    const { exporterId } = await owner();
    const m = await inbox().logBuyerMessage(exporterId, { invoiceId: input.invoiceId, body: input.body });
    after(() => handleInbound(inboxDeps(), { exporterId, invoiceId: input.invoiceId, messageId: m.id }).catch((e) => console.error(`[inbox] ${m.id}: ${(e as Error).message}`)));
    return m;
  });
}
