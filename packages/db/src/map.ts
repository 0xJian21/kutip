/** Row → UI shape mappers. Nulls become absent fields; timestamps become ISO strings. */
import type * as s from "./schema";
import type { AgentAction, Buyer, Invoice, Message, Payment, ReplyIntent, Rulebook, Sweep } from "./types";

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

export function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

/** Same defaults as @kutip/agent DEFAULT_REPLIES (kept here so @kutip/db has no agent dependency). */
export const DEFAULT_REPLIES: Rulebook["replies"] = { remindersAndReceipts: "automatic", buyerReplies: "draft" };

export function rulebookToJson(r: Rulebook): s.RulebookJson {
  return {
    collections: { ...r.collections },
    treasury: {
      ...r.treasury,
      agentDailyLimitUsdc: r.treasury.agentDailyLimitUsdc.toString(),
      cashOutAlertMarginBps: r.treasury.cashOutAlertMarginBps.toString(),
    },
    replies: { ...r.replies },
  };
}

export function rulebookFromJson(j: s.RulebookJson): Rulebook {
  return {
    collections: { ...j.collections },
    treasury: {
      ...j.treasury,
      agentDailyLimitUsdc: BigInt(j.treasury.agentDailyLimitUsdc),
      cashOutAlertMarginBps: BigInt(j.treasury.cashOutAlertMarginBps),
    },
    replies: { ...(j.replies ?? DEFAULT_REPLIES) },
  };
}

export function toBuyer(r: Row<typeof s.buyers>): Buyer {
  return {
    id: r.id,
    name: r.name,
    contactName: r.contactName,
    email: r.email,
    country: r.country,
    countryName: r.countryName,
    city: r.city,
    address: r.address,
    timezone: r.timezone,
    multisig: r.multisig,
    vault: r.vault,
    usdcAta: r.usdcAta,
  };
}

export function toInvoice(r: Row<typeof s.invoices>, appUrl: string): Invoice {
  return {
    id: r.id,
    buyerId: r.buyerId,
    number: r.number,
    lineItems: r.lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPriceUsdc: BigInt(li.unitPriceUsdc) })),
    amountUsdc: r.amountUsdc,
    receivedUsdc: r.receivedUsdc,
    issuedAt: r.issuedAt,
    dueDate: r.dueDate,
    status: r.status,
    referencePubkey: r.referencePubkey,
    memoCode: r.memoCode,
    createdAt: r.createdAt.toISOString(),
    sentAt: iso(r.sentAt),
    seenAt: iso(r.seenAt),
    paidAt: iso(r.paidAt),
    settledAt: iso(r.settledAt),
    payUrl: `${appUrl}/pay/${r.id}`,
    x402Url: `${appUrl}/api/x402/invoice/${r.id}`,
    ...(r.sendTo ? { sendTo: r.sendTo } : {}),
    ...(r.sendCc ? { sendCc: r.sendCc } : {}),
  };
}

export function toPayment(r: Row<typeof s.payments>): Payment {
  return {
    id: r.id,
    invoiceId: r.invoiceId,
    signature: r.signature,
    payer: r.payer,
    mint: "USDC",
    amount: r.amount,
    inputMint: (r.inputMint ?? undefined) as Payment["inputMint"],
    inputAmount: r.inputAmount ?? undefined,
    quotedOut: r.quotedOut ?? undefined,
    quotedInput: r.quotedInput ?? undefined,
    commitment: r.commitment,
    slot: r.slot,
    verified: r.verified,
    issues: r.issues,
    observedAt: r.observedAt.toISOString(),
    confirmedAt: iso(r.confirmedAt),
    finalizedAt: iso(r.finalizedAt),
    feePaidByKutip: true,
    via: r.via,
  };
}

export function toAction(r: Row<typeof s.agentActions>): AgentAction {
  return {
    id: r.id,
    kind: r.kind,
    buyerId: r.buyerId ?? undefined,
    invoiceId: r.invoiceId ?? undefined,
    inputSummary: r.inputSummary,
    decision: r.decision,
    reason: r.reason,
    confidence: r.confidence,
    ruleId: r.ruleId,
    status: r.status,
    txSignature: r.txSignature ?? undefined,
    proposalIndex: r.proposalIndex === null ? undefined : Number(r.proposalIndex),
    createdAt: r.createdAt.toISOString(),
  };
}

export function toMessage(r: Row<typeof s.messages>): Message {
  return {
    id: r.id,
    invoiceId: r.invoiceId,
    direction: r.direction,
    channel: "email",
    from: r.from,
    subject: r.subject,
    body: r.body,
    classification: r.classification
      ? { intent: r.classification.intent as ReplyIntent, confidence: r.classification.confidence }
      : undefined,
    ...(r.toAddress ? { toAddress: r.toAddress } : {}),
    ...(r.delivery ? { delivery: r.delivery } : {}),
    createdAt: r.createdAt.toISOString(),
  };
}

export function toSweep(r: Row<typeof s.sweeps>): Sweep {
  return {
    id: r.id,
    buyerIds: r.buyerIds,
    amountUsdc: r.amountUsdc,
    signature: r.signature ?? undefined,
    scheduledFor: r.scheduledFor.toISOString(),
    executedAt: iso(r.executedAt),
    status: r.executedAt ? "executed" : "scheduled",
  };
}
