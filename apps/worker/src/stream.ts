/**
 * One Solami Yellowstone gRPC stream (Spike C): transactions at processed + slot-status updates
 * (confirmed/finalized/dead for the tx's slot) + account updates for cached balances.
 * Filters are rewritten in place when the watched set changes, resent with every keepalive ping
 * (a bare ping replaced the filters on Solami's geyser), and the stream reconnects with backoff
 * on error, end, or silence.
 */
import Client, { CommitmentLevel, type SubscribeRequest, type SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";

export type Watched = {
  /** Open-invoice reference keys and buyer vault ATAs: any tx touching one is a candidate payment. */
  transactionKeys: string[];
  /** Treasury + vault USDC ATAs and the fee payer: streamed for cached balances. */
  balanceAccounts: string[];
};

/** A base58 string that decodes to 32 bytes. The seeded demo rows hold look-alike strings that don't. */
export function isPubkey(s: string): boolean {
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

/** One invalid key makes the geyser reject the whole subscription, so only real pubkeys go in. */
const sorted = (keys: string[]) => [...new Set(keys)].filter(isPubkey).sort();

export function buildRequest(w: Watched): SubscribeRequest {
  const txKeys = sorted(w.transactionKeys);
  const accounts = sorted(w.balanceAccounts);
  return {
    commitment: CommitmentLevel.PROCESSED,
    // Empty accountInclude / account lists mean "match everything" to Yellowstone: omit the filter instead.
    transactions: txKeys.length ? { kutip: { vote: false, failed: false, accountInclude: txKeys, accountExclude: [], accountRequired: [] } } : {},
    accounts: accounts.length ? { kutip: { account: accounts, owner: [], filters: [] } } : {},
    slots: { kutip: { filterByCommitment: false } },
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    accountsDataSlice: [],
  };
}

/** Solami's geyser treats a request as a full replacement, so the keepalive carries the filters too. */
export function withPing(request: SubscribeRequest, id: number): SubscribeRequest {
  return { ...request, ping: { id } };
}

export function filterKey(w: Watched): string {
  return `${sorted(w.transactionKeys).join(",")}|${sorted(w.balanceAccounts).join(",")}`;
}

export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}

const PING_EVERY_MS = 10_000;
/** Slots arrive every ~400 ms; this much quiet means the stream is dead even if it says otherwise. */
const SILENT_MS = 20_000;

export async function runStream(opts: {
  url: string;
  token: string;
  watched: () => Watched;
  /** Runs after each (re)subscribe, e.g. backfill what was missed. */
  onConnected: () => Promise<void>;
  onUpdate: (u: SubscribeUpdate, at: Date) => void;
  log: (msg: string) => void;
  signal: AbortSignal;
}): Promise<void> {
  const { log, signal } = opts;
  let attempt = 0;
  while (!signal.aborted) {
    let stream: Awaited<ReturnType<Client["subscribe"]>> | undefined;
    let timer: NodeJS.Timeout | undefined;
    try {
      const client = new Client(opts.url, opts.token, { grpcMaxDecodingMessageSize: 64 * 1024 * 1024 });
      await client.connect();
      const s = await client.subscribe();
      stream = s;
      let watched = opts.watched();
      let key = filterKey(watched);
      let request = buildRequest(watched);
      await new Promise<void>((res, rej) => s.write(request, (e: Error | null | undefined) => (e ? rej(e) : res())));
      log(`gRPC subscribed: ${watched.transactionKeys.length} tx keys, ${watched.balanceAccounts.length} balance accounts`);
      const connected = opts.onConnected().catch((e: Error) => log(`backfill failed: ${e.message}`));

      await new Promise<void>((resolve, reject) => {
        let last = Date.now();
        let lastPing = Date.now();
        let pingId = 0;
        s.on("data", (u: SubscribeUpdate) => {
          last = Date.now();
          attempt = 0;
          if (u.ping || u.pong) return;
          opts.onUpdate(u, new Date(last));
        });
        s.on("error", reject);
        s.on("end", () => reject(new Error("stream ended")));
        s.on("close", () => reject(new Error("stream closed")));
        signal.addEventListener("abort", () => resolve(), { once: true });
        timer = setInterval(() => {
          const now = Date.now();
          watched = opts.watched();
          const k = filterKey(watched);
          if (k !== key) {
            key = k;
            request = buildRequest(watched);
            s.write(request);
            log(`filters updated: ${watched.transactionKeys.length} tx keys, ${watched.balanceAccounts.length} balance accounts`);
          }
          if (now - lastPing >= PING_EVERY_MS) {
            lastPing = now;
            s.write(withPing(request, ++pingId));
          }
          if (now - last > SILENT_MS) reject(new Error(`no updates for ${SILENT_MS / 1000} s`));
        }, 1_000);
      });
      await connected;
    } catch (e) {
      if (signal.aborted) break;
      const wait = backoffMs(attempt++);
      log(`gRPC stream down (${(e as Error).message}); reconnecting in ${wait / 1000} s`);
      await new Promise((r) => setTimeout(r, wait));
    } finally {
      clearInterval(timer);
      stream?.destroy();
    }
  }
}
