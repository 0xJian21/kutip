/**
 * Kutip worker: Solami gRPC listener (payments + balances), collections scheduler, BNM rate,
 * daily sweep hook. One process, one gRPC stream. HTTP is only a health check.
 */
import Anthropic from "@anthropic-ai/sdk";
import { connect, createStore } from "@kutip/db";
import type { SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createBalances } from "./balances";
import { createCollections } from "./collections";
import { createDispatcher } from "./dispatch";
import { loadConfig } from "./config";
import { createMailer } from "./email";
import { createPaymentTracker } from "./payments";
import { updateRate } from "./rates";
import { createRpc } from "./rpc";
import { isPubkey, runStream, type Watched } from "./stream";
import { loadSweeper, nextSweepAt } from "./sweep";

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);
const cfg = loadConfig();
const { db, close } = connect(cfg.databaseUrl, { max: 3 });
const store = createStore(db, { appUrl: cfg.appUrl });
const rpc = createRpc(cfg.rpcUrl);
const anthropic = cfg.anthropicApiKey ? new Anthropic({ apiKey: cfg.anthropicApiKey }) : undefined;
const mailer = createMailer({ apiKey: cfg.resendApiKey, from: cfg.emailFrom, log });
const collections = createCollections({ store, anthropic, mailer, log, dryRun: cfg.collections === "dry" });
const balances = createBalances({ store, feePayer: cfg.feePayer, minLamports: cfg.feePayerMinLamports, log });
const tracker = createPaymentTracker({
  store,
  rpc,
  usdcMint: cfg.usdcMint,
  log,
  onPaid: async (paid) => {
    if (cfg.collections === "on") await collections.onPaid(paid);
    else log(`[collections ${cfg.collections}] paid ${paid.invoiceId}: cancel-reminders action and receipt skipped`);
  },
});

const dispatcher = createDispatcher({
  tracker,
  balances,
  log,
  // Test fixtures from the real stream: RECORD_GRPC_DIR=src/fixtures
  onTracked: (tx) => {
    if (!process.env.RECORD_GRPC_DIR) return;
    const json = JSON.stringify(tx, (_k, v) => (v instanceof Uint8Array ? { $b64: Buffer.from(v).toString("base64") } : v), 1);
    writeFileSync(`${process.env.RECORD_GRPC_DIR}/grpc-${bs58.encode(tx.transaction!.signature).slice(0, 8)}.json`, json);
  },
});
const { enqueue } = dispatcher;

let watched: Watched = { transactionKeys: [], balanceAccounts: [] };
async function refreshWatched() {
  const w = await store.listWatchedAccounts();
  tracker.setReferences(w.references);
  balances.setAccounts(w.balances);
  watched = { transactionKeys: [...w.references.map((r) => r.referencePubkey), ...w.vaultAtas], balanceAccounts: balances.accounts() };
}

const status = { connectedAt: null as string | null, lastUpdateAt: null as string | null, updates: 0 };
function onUpdate(u: SubscribeUpdate, at: Date) {
  status.updates++;
  status.lastUpdateAt = at.toISOString();
  dispatcher.onUpdate(u, at);
}

function every(ms: number, label: string, fn: () => Promise<void>) {
  const run = () => enqueue(label, fn);
  run();
  return setInterval(run, ms);
}

function scheduleSweep() {
  const at = nextSweepAt(new Date(), Math.random());
  log(`next sweep at ${at.toISOString()}`);
  return setTimeout(async () => {
    const sweep = await loadSweeper();
    if (!sweep) log("sweep skipped: @kutip/solana has no runDailySweep yet (Session 5)");
    else enqueue("sweep", () => sweep({ store, now: new Date(), log }));
    scheduleSweep();
  }, at.getTime() - Date.now());
}

async function main() {
  const abort = new AbortController();
  await refreshWatched();
  log(`watching ${watched.transactionKeys.length} tx keys, ${watched.balanceAccounts.length} balance accounts; collections ${cfg.collections}`);
  // Seed cached balances; afterwards the stream reports changes.
  for (const a of await rpc.getAccounts(watched.balanceAccounts.filter(isPubkey))) await balances.onAccount(a.pubkey, a.lamports, a.data, new Date());

  const timers = [
    setInterval(() => enqueue("refresh", refreshWatched), 5_000),
    every(10_000, "reconcile", () => tracker.reconcile(new Date())),
    every(6 * 3_600_000, "rate", () => updateRate({ store, log, now: new Date() })),
  ];
  if (cfg.collections !== "off") {
    timers.push(
      every(5 * 60_000, "collections", async () => {
        await collections.markOverdue(new Date());
        await collections.runReminders(new Date());
      }),
    );
  }
  const sweepTimer = scheduleSweep();

  const server = createServer((req, res) => {
    const ok = status.lastUpdateAt !== null && Date.now() - Date.parse(status.lastUpdateAt) < 60_000;
    res.writeHead(req.url !== "/health" ? 404 : ok ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok, ...status, pending: tracker.pending().length }));
  }).listen(cfg.port);

  const stop = async () => {
    log("shutting down");
    abort.abort();
    timers.forEach(clearInterval);
    clearTimeout(sweepTimer);
    server.close();
    await dispatcher.idle();
    await close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await runStream({
    url: cfg.grpcUrl,
    token: cfg.grpcToken,
    watched: () => watched,
    onConnected: async () => {
      status.connectedAt = new Date().toISOString();
      enqueue("backfill", () => tracker.backfill(new Date()));
    },
    onUpdate,
    log,
    signal: abort.signal,
  });
}

main().catch((e: Error) => {
  log(`fatal: ${e.stack ?? e.message}`);
  process.exit(1);
});
