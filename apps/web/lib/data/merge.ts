/**
 * Realtime Broadcast payloads (topic `invoice:<id>`, PLAN.md Session 4 Request) → UI types.
 * Bigints arrive as decimal strings, absent timestamps as null. Pure, so it is testable.
 */
import type { Invoice, InvoiceStatus, Payment } from "../ui/types";

type Raw = Record<string, unknown>;

export type InvoiceEvent = Pick<Invoice, "id" | "status" | "amountUsdc" | "receivedUsdc" | "seenAt" | "paidAt" | "settledAt">;

const big = (v: unknown): bigint | undefined => (v === null || v === undefined ? undefined : BigInt(v as string));
const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));

export function parseInvoiceEvent(p: Raw): InvoiceEvent {
  return {
    id: String(p.id),
    status: p.status as InvoiceStatus,
    amountUsdc: BigInt(p.amountUsdc as string),
    receivedUsdc: BigInt(p.receivedUsdc as string),
    seenAt: str(p.seenAt),
    paidAt: str(p.paidAt),
    settledAt: str(p.settledAt),
  };
}

export function parsePaymentEvent(p: Raw): Payment {
  return {
    id: String(p.id),
    invoiceId: String(p.invoiceId),
    signature: String(p.signature),
    payer: String(p.payer ?? ""),
    mint: "USDC",
    amount: BigInt(p.amount as string),
    inputMint: (p.inputMint ?? undefined) as Payment["inputMint"],
    inputAmount: big(p.inputAmount),
    quotedInput: big(p.quotedInput),
    quotedOut: big(p.quotedOut),
    commitment: p.commitment as Payment["commitment"],
    slot: Number(p.slot),
    verified: Boolean(p.verified),
    issues: (p.issues as string[] | null) ?? [],
    observedAt: String(p.observedAt),
    confirmedAt: str(p.confirmedAt),
    finalizedAt: str(p.finalizedAt),
    feePaidByKutip: true,
    via: (p.via as Payment["via"]) ?? "solana_pay",
  };
}

/** seen → paid → settled only moves forward, whatever order the events arrive in. */
const RANK: Partial<Record<InvoiceStatus, number>> = { seen: 1, paid: 2, settled: 3 };
export const forwardStatus = (current: InvoiceStatus, next: InvoiceStatus): InvoiceStatus => ((RANK[current] ?? 0) > (RANK[next] ?? 0) ? current : next);

export function mergeInvoiceEvent<T extends Invoice>(inv: T, e: InvoiceEvent): T {
  return {
    ...inv,
    status: forwardStatus(inv.status, e.status),
    receivedUsdc: e.receivedUsdc > inv.receivedUsdc ? e.receivedUsdc : inv.receivedUsdc,
    seenAt: e.seenAt ?? inv.seenAt,
    paidAt: e.paidAt ?? inv.paidAt,
    settledAt: e.settledAt ?? inv.settledAt,
  };
}
