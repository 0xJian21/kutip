/**
 * x402 v2 endpoint + self-hosted facilitator (SPEC F5, DECISIONS D5).
 *   GET without PAYMENT-SIGNATURE → 402 + PAYMENT-REQUIRED (exact, solana mainnet, USDC, payTo = buyer vault)
 *   GET with PAYMENT-SIGNATURE    → verify → co-sign as fee payer → submit → confirm → 200 + PAYMENT-RESPONSE + receipt
 *   already paid                  → 200 with the existing receipt (replay-safe)
 * Spec: https://github.com/x402-foundation/x402/blob/main/specs (v2 + transports-v2/http + schemes/exact/scheme_exact_svm)
 */
import { decodeHeader, encodeHeader, paymentRequired, paymentRequirements, settleX402, verifyX402, X402_HEADERS, type PaymentPayload, type SettleResponse } from "@kutip/solana";
import type { NextRequest } from "next/server";
import { amountDue, clientIp, json, PAYABLE, payTarget, runtime, screenPayer, type PayTarget } from "../../../pay/_lib/server";

// Fee-payer protection (per instance): a payload that passes simulation can still fail on-chain, and Kutip pays for it.
/** One settlement in flight per invoice; a parallel payload gets 409 instead of a second co-signed tx. */
const settling = new Set<string>();
/** A payer whose co-signed tx failed on-chain waits before Kutip co-signs for it again. */
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 10 * 60_000;

type Ctx = { params: Promise<{ id: string }> };
const CORS = { "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "Content-Type, PAYMENT-SIGNATURE", "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE" };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", ...CORS } });
}

const receiptBody = (t: PayTarget, s: SettleResponse) => ({
  invoiceId: t.invoiceId,
  invoiceNumber: t.invoiceNumber,
  exporterName: t.exporterName,
  amountUsdc: t.amountUsdc.toString(),
  signature: s.transaction,
  explorer: `https://solscan.io/tx/${s.transaction}`,
  message: `Invoice ${t.invoiceNumber} paid. ${t.exporterName} has been notified.`,
});

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const rt = runtime();
  const target = await payTarget(id);
  if (!target) return json(404, { error: "invoice not found" }, CORS);

  // Replays and already-paid invoices return the existing receipt instead of settling twice.
  const existing = rt.receipts.get(id) ?? (await paidReceipt(target));
  if (existing) return json(200, receiptBody(target, existing), { ...CORS, [X402_HEADERS.response]: encodeHeader(existing) });
  if (!PAYABLE.has(target.status)) return json(409, { error: `invoice is ${target.status}` }, CORS);

  const due = amountDue(target);
  const requirements = paymentRequirements({
    amountUsdc: due,
    payTo: target.vault,
    feePayer: rt.config.feePayer.publicKey.toBase58(),
    memo: target.memoCode,
    reference: target.referencePubkey,
    usdcMint: rt.config.usdcMint,
  });
  const resource = { url: `${rt.config.appUrl}/api/x402/invoice/${id}`, description: `Invoice ${target.invoiceNumber} to ${target.exporterName}`, mimeType: "application/json" };
  const required = (error?: string) => paymentRequired({ resource, accepts: [requirements], error });
  const respond402 = (error: string, extra: Record<string, string> = {}) =>
    json(402, required(error), { ...CORS, [X402_HEADERS.required]: encodeHeader(required(error)), ...extra });

  const header = req.headers.get(X402_HEADERS.signature);
  if (!header) return respond402("payment required");
  if (!rt.invoiceLimiter.allow(`x402:${id}`) || !rt.walletLimiter.allow(`x402-ip:${clientIp(req.headers)}`)) {
    return json(429, { error: "too many payment attempts; retry in a minute" }, CORS);
  }
  if (settling.has(id)) return json(409, { error: "a payment for this invoice is being settled; retry shortly" }, CORS);
  settling.add(id);
  try {
    return await settle({ id, rt, target, due, requirements, required, respond402, header });
  } finally {
    settling.delete(id);
  }
}

async function settle(
  c: {
    id: string;
    rt: ReturnType<typeof runtime>;
    target: PayTarget;
    due: bigint;
    requirements: ReturnType<typeof paymentRequirements>;
    required: (error?: string) => ReturnType<typeof paymentRequired>;
    respond402: (error: string, extra?: Record<string, string>) => Response;
    header: string;
  },
): Promise<Response> {
  const { id, rt, target, due, requirements, required, respond402, header } = c;

  let payload: PaymentPayload;
  try {
    payload = decodeHeader<PaymentPayload>(header);
  } catch {
    return json(400, { error: "PAYMENT-SIGNATURE must be base64 JSON" }, CORS);
  }
  const verified = await verifyX402({ payload, requirements, feePayer: rt.config.feePayer.publicKey, rpc: rt.x402Rpc, replay: rt.replay });
  if (!verified.ok) {
    console.warn(`[x402] rejected ${id}: ${verified.reason} (${verified.message})`);
    const fail: SettleResponse = { success: false, errorReason: verified.reason, transaction: "", network: requirements.network };
    return json(400, { ...required(verified.message), invalidReason: verified.reason }, { ...CORS, [X402_HEADERS.required]: encodeHeader(required(verified.message)), [X402_HEADERS.response]: encodeHeader(fail) });
  }

  if ((cooldown.get(verified.payer) ?? 0) > Date.now()) return json(429, { error: "a recent payment from this wallet failed on-chain; retry later" }, CORS);
  const gate = await screenPayer(rt, target, verified.payer); // same sanctions + history gate as Solana Pay
  if (!gate.ok) return json(403, { error: gate.message }, CORS);

  const settled = await settleX402({ verified, feePayer: rt.config.feePayer, rpc: rt.x402Rpc });
  if (!settled.success) {
    console.error(`[x402] settle failed ${id}: ${settled.errorReason}`);
    if (settled.errorReason?.startsWith("transaction failed on-chain")) cooldown.set(verified.payer, Date.now() + COOLDOWN_MS); // landed and failed: the fee payer paid
    return respond402(settled.errorReason ?? "settlement failed", { [X402_HEADERS.response]: encodeHeader(settled) });
  }
  rt.receipts.set(id, settled);
  console.log(`[x402] settled ${id} ${settled.transaction} payer ${settled.payer?.slice(0, 6)}…`);
  // Idempotent by signature; the worker's gRPC listener upgrades it to finalized (Session 4).
  await rt.store
    .recordPayment({ invoiceId: id, signature: settled.transaction, payer: settled.payer ?? "", amount: due, commitment: "confirmed", slot: 0, verified: true, issues: [], via: "x402" })
    .catch((e: Error) => console.error(`[x402] recordPayment failed: ${e.message}`));
  return json(200, receiptBody(target, settled), { ...CORS, [X402_HEADERS.response]: encodeHeader(settled) });
}

async function paidReceipt(target: PayTarget): Promise<SettleResponse | undefined> {
  if (target.status !== "paid" && target.status !== "settled") return undefined;
  const pay = await runtime().store.getPayInvoice(target.invoiceId);
  if (!pay?.payment) return undefined;
  return { success: true, transaction: pay.payment.signature, network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" };
}
