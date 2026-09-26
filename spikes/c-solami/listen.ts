// Spike C — Solami as the data path: Yellowstone gRPC listener.
//
// Usage:
//   pnpm --filter @kutip/spikes exec tsx c-solami/listen.ts <referencePubkey> <vaultAta> [more pubkeys] [--mode=slots|streams]
//
// Env (repo-root .env): SOLAMI_GRPC_URL (e.g. https://grpc.solami.dev), SOLAMI_GRPC_KEY or SOLAMI_API_KEY (gRPC-type key).
//
// Modes:
//   slots   (default) ONE stream: transactions@processed + slot status updates. t_confirmed/t_finalized are taken
//           from the slot-status message for the tx's slot — this is the same moment Yellowstone would emit the tx on a
//           confirmed/finalized stream, and it fits Solami's per-plan stream cap (Pro = 2 streams).
//   streams THREE streams on one connection, one per commitment level (what the spike spec literally asks for).
//
// Yellowstone facts this relies on (see notes/c-solami.md): commitment is per SubscribeRequest (not per filter);
// the server pings every 15s and idle streams get cut by load balancers, so we write a ping request every 10s;
// writing a new SubscribeRequest on the same stream replaces the filters without reconnecting.

import { fileURLToPath } from "node:url";
import Client, {
  CommitmentLevel,
  SlotStatus,
  type SubscribeRequest,
  type SubscribeUpdate,
  type SubscribeUpdateTransactionInfo,
} from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  /* .env optional — env may already be set */
}

const USDC_MINT = process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

const argv = process.argv.slice(2);
const mode = argv.find((a) => a.startsWith("--mode="))?.slice("--mode=".length) ?? "slots";
const watched = argv.filter((a) => !a.startsWith("--"));
if (watched.length === 0 || (mode !== "slots" && mode !== "streams")) {
  console.error("usage: tsx c-solami/listen.ts <pubkey> [<pubkey> ...] [--mode=slots|streams]");
  process.exit(1);
}

// Solami docs show `https://grpc.solami.fast?api_key=KEY`; their own Rust starter and JS SDK pass the key as the
// gRPC `x-token` header instead. tonic (used by the napi client) drops URL query strings, so we always use x-token.
const grpcUrl = new URL(process.env.SOLAMI_GRPC_URL ?? "https://grpc.solami.dev");
const xToken =
  grpcUrl.searchParams.get("api_key") ?? process.env.SOLAMI_GRPC_KEY ?? process.env.SOLAMI_API_KEY;
grpcUrl.search = "";
if (!xToken) {
  console.error("missing SOLAMI_GRPC_KEY / SOLAMI_API_KEY");
  process.exit(1);
}

type Row = {
  sig: string;
  slot: string;
  tProcessed?: number;
  tConfirmed?: number;
  tFinalized?: number;
  serverLagMs?: number; // Date.now() - update.createdAt (Solami's geyser timestamp) at processed
  dead?: boolean;
  check: string;
};
const rows = new Map<string, Row>();
const sigsBySlot = new Map<string, string[]>();

const emptyRequest: SubscribeRequest = {
  accounts: {},
  slots: {},
  transactions: {},
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  accountsDataSlice: [],
};

function txRequest(commitment: CommitmentLevel, withSlots: boolean): SubscribeRequest {
  return {
    ...emptyRequest,
    commitment,
    // One filter with all watched keys (accountInclude is OR). One filter, not one-per-key: Yellowstone's default
    // `filter_limits.transactions.max` is 1 and Solami doesn't publish theirs.
    transactions: {
      kutip: { vote: false, failed: false, accountInclude: watched, accountExclude: [], accountRequired: [] },
    },
    slots: withSlots ? { kutip: { filterByCommitment: false } } : {},
  };
}

function describe(info: SubscribeUpdateTransactionInfo): string {
  const msg = info.transaction?.message;
  const meta = info.meta;
  // Full key list = static keys + address-lookup-table loaded keys (token balances index into this combined list).
  const keys = [
    ...(msg?.accountKeys ?? []),
    ...(meta?.loadedWritableAddresses ?? []),
    ...(meta?.loadedReadonlyAddresses ?? []),
  ].map((k) => bs58.encode(k));
  const matched = watched.filter((w) => keys.includes(w));

  const pre = new Map((meta?.preTokenBalances ?? []).map((b) => [b.accountIndex, b]));
  const credits = (meta?.postTokenBalances ?? [])
    .map((post) => ({
      account: keys[post.accountIndex] ?? "?",
      mint: post.mint,
      owner: post.owner,
      delta: BigInt(post.uiTokenAmount?.amount ?? "0") - BigInt(pre.get(post.accountIndex)?.uiTokenAmount?.amount ?? "0"),
    }))
    .filter((d) => d.delta > 0n);
  const toWatched = credits.find((d) => watched.includes(d.account)) ?? credits[0];

  const memos = (msg?.instructions ?? [])
    .filter((ix) => keys[ix.programIdIndex] === MEMO_PROGRAM)
    .map((ix) => JSON.stringify(Buffer.from(ix.data).toString("utf8")));

  const parts = [
    meta?.err ? "status=FAILED" : "status=ok",
    `matched=[${matched.join(",")}]`,
    toWatched
      ? `mint=${toWatched.mint === USDC_MINT ? "USDC" : `NOT-USDC(${toWatched.mint})`} amount=+${toWatched.delta} ` +
        `dest=${toWatched.account} destOwner=${toWatched.owner}`
      : "no token credit",
    `memo=${memos.length ? memos.join("|") : "none"}`,
    `logs=${meta?.logMessages?.length ?? 0}`,
  ];
  return parts.join(" ");
}

function onTx(level: "processed" | "confirmed" | "finalized", u: SubscribeUpdate, now: number) {
  const tx = u.transaction;
  if (!tx?.transaction) return;
  const sig = bs58.encode(tx.transaction.signature);
  let row = rows.get(sig);
  if (!row) {
    row = { sig, slot: tx.slot, check: describe(tx.transaction) };
    rows.set(sig, row);
    sigsBySlot.set(tx.slot, [...(sigsBySlot.get(tx.slot) ?? []), sig]);
  }
  if (level === "processed" && row.tProcessed === undefined) {
    row.tProcessed = now;
    if (u.createdAt) row.serverLagMs = now - u.createdAt.getTime();
  }
  if (level === "confirmed" && row.tConfirmed === undefined) row.tConfirmed = now;
  if (level === "finalized" && row.tFinalized === undefined) row.tFinalized = now;
  console.log(`[${new Date(now).toISOString()}] ${level.padEnd(9)} slot=${tx.slot} sig=${sig}`);
  if (level === "processed") console.log(`    ${row.check}`);
  if (level === "finalized") printTable();
}

function onSlot(u: SubscribeUpdate, now: number) {
  const s = u.slot;
  if (!s) return;
  const sigs = sigsBySlot.get(s.slot);
  if (!sigs) return;
  for (const sig of sigs) {
    const row = rows.get(sig)!;
    if (s.status === SlotStatus.SLOT_CONFIRMED && row.tConfirmed === undefined) {
      row.tConfirmed = now;
      console.log(`[${new Date(now).toISOString()}] confirmed slot=${s.slot} sig=${sig} (slot status)`);
    } else if (s.status === SlotStatus.SLOT_FINALIZED && row.tFinalized === undefined) {
      row.tFinalized = now;
      console.log(`[${new Date(now).toISOString()}] finalized slot=${s.slot} sig=${sig} (slot status)`);
      printTable();
    } else if (s.status === SlotStatus.SLOT_DEAD) {
      row.dead = true;
      console.log(`[${new Date(now).toISOString()}] DEAD slot=${s.slot} sig=${sig} ${s.deadError ?? ""}`);
    }
  }
}

function printTable() {
  if (rows.size === 0) return console.log("(no matching transactions yet)");
  console.table(
    [...rows.values()].map((r) => ({
      signature: `${r.sig.slice(0, 8)}…${r.sig.slice(-4)}`,
      slot: r.slot,
      t_processed: r.tProcessed ? new Date(r.tProcessed).toISOString().slice(11, 23) : "",
      t_confirmed: r.tConfirmed ? new Date(r.tConfirmed).toISOString().slice(11, 23) : "",
      t_finalized: r.tFinalized ? new Date(r.tFinalized).toISOString().slice(11, 23) : "",
      "proc→conf ms": r.tProcessed && r.tConfirmed ? r.tConfirmed - r.tProcessed : "",
      "conf→fin ms": r.tConfirmed && r.tFinalized ? r.tFinalized - r.tConfirmed : "",
      "proc→fin ms": r.tProcessed && r.tFinalized ? r.tFinalized - r.tProcessed : "",
      "geyser→us ms": r.serverLagMs ?? "",
      dead: r.dead ? "yes" : "",
    })),
  );
  for (const r of rows.values()) console.log(`${r.sig}\n    ${r.check}`);
}

async function openStream(
  client: Client,
  name: string,
  request: SubscribeRequest,
  onData: (u: SubscribeUpdate, now: number) => void,
) {
  const stream = await client.subscribe();
  const debug = process.argv.includes("--debug");
  const counts: Record<string, number> = {};
  stream.on("data", (u: SubscribeUpdate) => {
    const now = Date.now();
    if (debug) {
      const kind = (["transaction", "slot", "ping", "pong", "account", "block", "blockMeta", "entry"] as const).find((k) => u[k]) ?? "other";
      counts[kind] = (counts[kind] ?? 0) + 1;
      if (kind === "transaction" || counts[kind]! % 20 === 1) console.log(`[debug ${name}] ${kind} #${counts[kind]} slot=${u.slot?.slot ?? u.transaction?.slot ?? ""} filters=${u.filters.join(",")}`);
    }
    if (u.pong) return;
    if (u.ping) return; // server keepalive; our interval below answers it
    onData(u, now);
  });
  stream.on("error", (e: Error) => console.error(`[${name}] stream error:`, e.message));
  stream.on("end", () => console.log(`[${name}] stream ended`));
  await new Promise<void>((resolve, reject) => stream.write(request, (e) => (e ? reject(e) : resolve())));
  // Keepalive. VERIFIED 2026-09-27 on Solami (geyser 15.2.1): a ping with EMPTY filters replaced our filters and the
  // stream went silent after the first ping (spike C run 1 missed its payment). So resend the full filters with the ping.
  const keepalive = setInterval(() => stream.write({ ...request, ping: { id: 1 } }), 10_000);
  stream.on("close", () => clearInterval(keepalive));
  console.log(`[${name}] subscribed`);
  return stream;
}

async function main() {
  console.log(`endpoint=${grpcUrl.origin} mode=${mode}`);
  console.log(`watching ${watched.length} account(s):\n  ${watched.join("\n  ")}`);

  const client = new Client(grpcUrl.origin, xToken, undefined);
  await client.connect();
  const version = await client.getVersion();
  console.log(`geyser version: ${version.version}`);

  if (mode === "slots") {
    await openStream(client, "processed+slots", txRequest(CommitmentLevel.PROCESSED, true), (u, now) => {
      if (u.transaction) onTx("processed", u, now);
      else if (u.slot) onSlot(u, now);
    });
  } else {
    const levels = [
      ["processed", CommitmentLevel.PROCESSED],
      ["confirmed", CommitmentLevel.CONFIRMED],
      ["finalized", CommitmentLevel.FINALIZED],
    ] as const;
    for (const [name, commitment] of levels) {
      await openStream(client, name, txRequest(commitment, false), (u, now) => {
        if (u.transaction) onTx(name, u, now);
      });
    }
  }
  console.log("listening — Ctrl-C to print the table and exit");
  process.on("SIGINT", () => {
    printTable();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
