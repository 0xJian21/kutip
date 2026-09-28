/**
 * Server-only wiring shared by /api/pay and /api/x402 (Session 3). Routes stay
 * thin: validate → call @kutip/solana / @kutip/db. Singletons live on
 * globalThis so `next dev` HMR and per-instance serverless reuse them.
 */
import path from "node:path";
import { after } from "next/server";
import { connect, createStore, type Store } from "@kutip/db";
import {
  blockingScreening,
  InFlight,
  jupiterClient,
  LiveTxCache,
  makeConnection,
  paymentsConfigFromEnv,
  RateLimiter,
  ReplayCache,
  reusableScreening,
  rpcFromConnection,
  SANCTIONED,
  screeningRpcFromConnection,
  screenWithBudget,
  x402RpcFromConnection,
  type BuiltPayment,
  type JupiterClient,
  type PaymentsConfig,
  type SettleResponse,
  type Connection,
  PublicKey,
} from "@kutip/solana";

type Runtime = {
  config: PaymentsConfig;
  store: Store;
  db: ReturnType<typeof connect>["db"];
  connection: Connection;
  rpc: ReturnType<typeof rpcFromConnection>;
  screeningRpc: ReturnType<typeof screeningRpcFromConnection>;
  x402Rpc: ReturnType<typeof x402RpcFromConnection>;
  jupiter: JupiterClient;
  liveTx: LiveTxCache<BuiltPayment>;
  invoiceLimiter: RateLimiter;
  walletLimiter: RateLimiter;
  replay: ReplayCache;
  receipts: Map<string, SettleResponse>;
  /** Concurrent POSTs for the same invoice + wallet + token share one screen + build. */
  inflight: InFlight<{ status: number; body: unknown }>;
};

declare global {
  var __kutipPayments: Runtime | undefined;
}

function loadRootEnvIfNeeded(): void {
  if (process.env["FEE_PAYER_SECRET"]) return;
  try {
    process.loadEnvFile(path.resolve(process.cwd(), "../../.env")); // next dev runs in apps/web; root .env is the source
  } catch {
    /* production sets real env */
  }
}

export function runtime(): Runtime {
  if (globalThis.__kutipPayments) return globalThis.__kutipPayments;
  loadRootEnvIfNeeded();
  const config = paymentsConfigFromEnv();
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("missing env DATABASE_URL");
  const { db } = connect(databaseUrl);
  const connection = makeConnection(config.rpcUrl);
  globalThis.__kutipPayments = {
    config,
    db,
    store: createStore(db, { appUrl: config.appUrl }),
    connection,
    rpc: rpcFromConnection(connection),
    screeningRpc: screeningRpcFromConnection(connection),
    x402Rpc: x402RpcFromConnection(connection),
    jupiter: jupiterClient({ apiKey: config.jupiterApiKey, baseUrl: config.jupiterBaseUrl }),
    // Short enough that a cached tx still has most of its ~60–90 s blockhash life when the wallet shows it.
    liveTx: new LiveTxCache<BuiltPayment>({ ttlMs: 20_000 }),
    invoiceLimiter: new RateLimiter({ limit: 10, windowMs: 60_000 }),
    walletLimiter: new RateLimiter({ limit: 10, windowMs: 60_000 }),
    replay: new ReplayCache(),
    receipts: new Map(),
    inflight: new InFlight(),
  };
  return globalThis.__kutipPayments;
}

export type PayTarget = {
  invoiceId: string;
  exporterId: string;
  buyerId: string;
  invoiceNumber: string;
  exporterName: string;
  status: string;
  amountUsdc: bigint;
  receivedUsdc: bigint;
  referencePubkey: string;
  memoCode: string;
  vault: string;
  vaultUsdcAta: string;
  acceptedTokens: Array<"USDC" | "SOL" | "USDT">;
};

/**
 * What tx building needs for one invoice, by invoice id. Only this invoice's
 * row and its own buyer's vault; nothing about other buyers.
 * (Requested from @kutip/db as `getPayTarget(invoiceId)`; direct query until then.)
 */
export async function payTarget(invoiceId: string): Promise<PayTarget | null> {
  const { db } = runtime();
  const inv = await db.query.invoices.findFirst({ where: (t, { eq }) => eq(t.id, invoiceId) });
  if (!inv || inv.status === "draft") return null;
  const [buyer, exporter] = await Promise.all([
    db.query.buyers.findFirst({ where: (t, { eq }) => eq(t.id, inv.buyerId) }),
    db.query.exporters.findFirst({ where: (t, { eq }) => eq(t.id, inv.exporterId) }),
  ]);
  if (!buyer || !exporter) return null;
  return {
    invoiceId: inv.id,
    exporterId: inv.exporterId,
    buyerId: inv.buyerId,
    invoiceNumber: inv.number,
    exporterName: exporter.name,
    status: inv.status,
    amountUsdc: inv.amountUsdc,
    receivedUsdc: inv.receivedUsdc,
    referencePubkey: inv.referencePubkey,
    memoCode: inv.memoCode,
    vault: buyer.vault,
    vaultUsdcAta: buyer.usdcAta,
    acceptedTokens: exporter.rulebook.treasury.acceptedTokens,
  };
}

export const PAYABLE = new Set(["sent", "seen", "overdue", "partially_paid"]);

/** Amount still owed; partially paid invoices are topped up. */
export const amountDue = (t: PayTarget): bigint => (t.amountUsdc > t.receivedUsdc ? t.amountUsdc - t.receivedUsdc : 0n);

/** Session 4 is adding `recordQuote` to @kutip/db; call it when present. */
export async function recordQuote(reference: string, quote: { inputMint: "SOL" | "USDT"; quotedInput: bigint; quotedOut: bigint }): Promise<void> {
  const store = runtime().store as Store & { recordQuote?: (reference: string, q: typeof quote) => Promise<void> };
  if (typeof store.recordQuote === "function") await store.recordQuote(reference, quote);
  else console.warn(`[pay] recordQuote not in @kutip/db yet; quote for ${reference.slice(0, 6)}…: ${quote.inputMint} ${quote.quotedInput} → ${quote.quotedOut}`);
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "access-control-allow-origin": "*", "cache-control": "no-store", ...headers } });

const SCREEN_BUDGET_MS = 2_500;

/**
 * The payer gate shared by Solana Pay and x402. A recorded flag (incl. a late verdict) keeps the wallet out;
 * a pass from the last 24 h is reused; the static sanctions list is always checked. A fresh history check
 * gets SCREEN_BUDGET_MS: past that the wallet passes provisionally and the verdict is recorded after the
 * response (Fluid compute: 300 s function lifetime, a slow screen takes 12–37 s).
 */
export async function screenPayer(rt: Runtime, target: PayTarget, wallet: string): Promise<{ ok: true; note: string } | { ok: false; message: string }> {
  const refused = { ok: false as const, message: `This wallet can't be used to pay ${target.exporterName}. Please contact them for another payment method.` };
  const latest = SANCTIONED.has(wallet) ? null : await rt.store.latestScreening(wallet);
  const blocked = blockingScreening(latest);
  if (blocked) {
    console.warn(`[pay] refused ${wallet} for ${target.invoiceId}: ${blocked.reasons.join("; ")}`);
    return refused;
  }
  const reused = reusableScreening(latest, new Date());
  const budgeted = reused ? null : await screenWithBudget(new PublicKey(wallet), { rpc: rt.screeningRpc, budgetMs: SCREEN_BUDGET_MS });
  const screening = reused ?? budgeted!.result;
  if (budgeted?.late) after(() => finishScreening(rt, target, wallet, budgeted.late!));
  // Every invoice gets its own row, even when the screening was reused (the compliance trail shows which check covered which invoice).
  else await rt.store.recordScreening({ wallet, invoiceId: target.invoiceId, result: screening.result, reasons: reused ? [`reused screening ${latest?.id} from ${latest?.createdAt}`, ...screening.reasons] : screening.reasons });
  if (screening.result === "flag") {
    console.warn(`[pay] flagged ${wallet} for ${target.invoiceId}: ${screening.reasons.join("; ")}`);
    return refused;
  }
  return { ok: true, note: reused ? " (reused)" : budgeted?.late ? " (provisional)" : "" };
}

/** The history check that ran past the budget: record it; a bad verdict escalates the invoice for the owner to review. */
async function finishScreening(rt: Runtime, target: PayTarget, wallet: string, late: Promise<{ result: "pass" | "flag"; reasons: string[] }>) {
  const t0 = Date.now();
  const r = await late;
  await rt.store.recordScreening({ wallet, invoiceId: target.invoiceId, result: r.result, reasons: r.reasons });
  console.log(`[pay] late screening for ${wallet.slice(0, 6)}… on ${target.invoiceId}: ${r.result} (+${Date.now() - t0} ms after the response)`);
  if (r.result === "pass") return;
  await rt.store.recordAgentAction({
    exporterId: target.exporterId,
    buyerId: target.buyerId,
    invoiceId: target.invoiceId,
    kind: "escalate",
    status: "escalated",
    ruleId: "T1",
    confidence: 1,
    inputSummary: `Payer ${wallet.slice(0, 6)}… on ${target.invoiceNumber}: ${r.reasons.join("; ")}`,
    decision: `Flagged the paying wallet on ${target.invoiceNumber} for your review`,
    reason: "The wallet check finished after the payment was prepared and did not pass",
  });
}

/** The caller's IP as the platform saw it (Vercel sets x-real-ip; the first x-forwarded-for entry is client-controlled elsewhere). */
export const clientIp = (h: Headers): string => h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
