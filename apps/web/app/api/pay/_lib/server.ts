/**
 * Server-only wiring shared by /api/pay and /api/x402 (Session 3). Routes stay
 * thin: validate → call @kutip/solana / @kutip/db. Singletons live on
 * globalThis so `next dev` HMR and per-instance serverless reuse them.
 */
import path from "node:path";
import { connect, createStore, type Store } from "@kutip/db";
import {
  InFlight,
  jupiterClient,
  LiveTxCache,
  makeConnection,
  paymentsConfigFromEnv,
  RateLimiter,
  ReplayCache,
  rpcFromConnection,
  screeningRpcFromConnection,
  x402RpcFromConnection,
  type BuiltPayment,
  type JupiterClient,
  type PaymentsConfig,
  type SettleResponse,
  type Connection,
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
