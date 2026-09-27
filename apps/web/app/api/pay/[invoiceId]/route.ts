/**
 * Solana Pay transaction request (SPEC F4). GET → {label, icon}; POST {account} →
 * screen the wallet → build a fee-sponsored tx → {transaction, message}.
 * Spec: https://solana.com/docs/tools/solana-pay/specification/version1
 */
import { buildPaymentTx, chooseMode, getAssociatedTokenAddressSync, PublicKey, reusableScreening, SANCTIONED, screenWallet } from "@kutip/solana";
import type { NextRequest } from "next/server";
import { amountDue, json, PAYABLE, payTarget, recordQuote, runtime } from "../_lib/server";

type Ctx = { params: Promise<{ invoiceId: string }> };

const CORS = { "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "Content-Type, Accept, Accept-Encoding" };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", ...CORS } });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { invoiceId } = await params;
  const target = await payTarget(invoiceId);
  if (!target) return json(404, { message: "Invoice not found" });
  const { config } = runtime();
  return json(200, { label: target.exporterName, icon: `${config.appUrl}/api/pay/icon` }, CORS);
}

const fmtUsdc = (n: bigint) => `${n / 1_000_000n}.${(n % 1_000_000n).toString().padStart(6, "0").replace(/0{0,4}$/, "")}`;

export async function POST(req: NextRequest, { params }: Ctx) {
  const { invoiceId } = await params;
  const rt = runtime();
  const target = await payTarget(invoiceId);
  if (!target) return json(404, { message: "Invoice not found" });
  if (!PAYABLE.has(target.status)) return json(409, { message: `Invoice ${target.invoiceNumber} is already ${target.status}` });
  const due = amountDue(target);
  if (due <= 0n) return json(409, { message: `Invoice ${target.invoiceNumber} is already paid` });

  let buyer: PublicKey;
  try {
    const body = (await req.json()) as { account?: string };
    buyer = new PublicKey(body.account ?? "");
  } catch {
    return json(400, { message: "Body must be {account: <base58 pubkey>}" });
  }
  const wallet = buyer.toBase58();
  if (!rt.invoiceLimiter.allow(`inv:${invoiceId}`) || !rt.walletLimiter.allow(`wallet:${wallet}`)) {
    return json(429, { message: "Too many payment attempts; please wait a minute and try again" });
  }

  // One live tx per invoice: a wallet that POSTs twice gets the same partially signed tx while the blockhash is fresh.
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const liveKey = `${wallet}:${token?.toUpperCase() ?? "auto"}`;
  const cached = rt.liveTx.get(invoiceId, liveKey);
  if (cached) return json(200, { transaction: cached.base64, message: paymentMessage(target, due, cached.quote?.inputMint) }, CORS);

  // Solflare re-POSTs in parallel: every concurrent request for this invoice + wallet + token awaits one screen + build.
  const out = await rt.inflight.run(`${invoiceId}:${liveKey}`, () => prepare({ rt, target, due, buyer, wallet, invoiceId, token, liveKey }));
  return json(out.status, out.body, out.status === 200 ? CORS : {});
}

async function prepare(p: {
  rt: ReturnType<typeof runtime>;
  target: NonNullable<Awaited<ReturnType<typeof payTarget>>>;
  due: bigint;
  buyer: PublicKey;
  wallet: string;
  invoiceId: string;
  token: string | undefined;
  liveKey: string;
}): Promise<{ status: number; body: unknown }> {
  const { rt, target, due, buyer, wallet, invoiceId, token, liveKey } = p;
  const t0 = Date.now();
  // A pass from the last 24 h is reused (a first screen takes 12–37 s); the static sanctions list is always checked.
  const reused = SANCTIONED.has(wallet) ? null : reusableScreening(await rt.store.latestScreening(wallet), new Date());
  const screening = reused ?? (await screenWallet(buyer, { rpc: rt.screeningRpc }));
  if (!reused) await rt.store.recordScreening({ wallet, invoiceId, result: screening.result, reasons: screening.reasons });
  if (screening.result === "flag") {
    console.warn(`[pay] flagged ${wallet} for ${invoiceId}: ${screening.reasons.join("; ")}`);
    return { status: 403, body: { message: `This wallet can't be used to pay ${target.exporterName}. Please contact them for another payment method.` } };
  }
  const tScreen = Date.now() - t0;

  const usdcAta = getAssociatedTokenAddressSync(rt.config.usdcMint, buyer, true);
  const usdcBalance = (await rt.rpc.getTokenAccount(usdcAta))?.amount ?? 0n;
  const choice = chooseMode({ token, accepted: target.acceptedTokens, solEnabled: rt.config.solEnabled, usdcBalance, amount: due });
  if ("error" in choice) return { status: 400, body: { message: choice.error } };

  try {
    const built = await buildPaymentTx({
      rpc: rt.rpc,
      feePayer: rt.config.feePayer,
      buyer,
      amountUsdc: due,
      destinationAta: new PublicKey(target.vaultUsdcAta),
      reference: new PublicKey(target.referencePubkey),
      memo: target.memoCode,
      mode: choice.mode,
      txVersion: "legacy",
      usdcMint: rt.config.usdcMint,
      cuPriceMicroLamports: rt.config.cuPriceMicroLamports,
      jupiter: rt.jupiter,
    });
    rt.liveTx.set(invoiceId, liveKey, built);
    if (built.quote) await recordQuote(target.referencePubkey, built.quote);
    console.log(`[pay] built ${choice.mode} tx for ${invoiceId} wallet ${wallet.slice(0, 6)}… ${built.transaction.length}B ${built.version} · screen ${tScreen} ms${reused ? " (reused)" : ""}, total ${Date.now() - t0} ms`);
    return { status: 200, body: { transaction: built.base64, message: paymentMessage(target, due, built.quote?.inputMint) } };
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[pay] build failed for ${invoiceId}: ${msg}`);
    return { status: 400, body: { message: walletFacing(msg, target.exporterName) } };
  }
}

function paymentMessage(t: { invoiceNumber: string; exporterName: string }, due: bigint, inputMint?: "SOL" | "USDT"): string {
  const via = inputMint ? ` paid in ${inputMint}` : "";
  return `${t.exporterName} · Invoice ${t.invoiceNumber} · ${fmtUsdc(due)} USDC${via} · network fee covered by Kutip`;
}

/** Keep RPC/Jupiter internals out of the wallet's error toast. */
function walletFacing(msg: string, exporter: string): string {
  if (/no USDC token account|USDC balance/.test(msg)) return "Not enough USDC in this wallet for this invoice";
  if (/SOL balance/.test(msg)) return "Not enough SOL in this wallet to cover this invoice";
  if (/USDT/.test(msg)) return "Not enough USDT in this wallet for this invoice";
  if (/jupiter/i.test(msg)) return "Swap pricing is unavailable right now; please pay in USDC or try again shortly";
  return `Payment to ${exporter} could not be prepared. Please try again.`;
}
