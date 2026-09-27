import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import sanctioned from "./sanctioned.json";
import { SANCTIONED, screenWallet, screenWithBudget, type ScreeningRpc } from "./screen";

const NOW = new Date("2026-09-27T05:00:00Z");
const wallet = Keypair.generate().publicKey;
const funder = Keypair.generate().publicKey;
const SDN = new PublicKey(sanctioned.addresses[0]!.address);

type Sig = { signature: string; blockTime: number | null };
const secondsAgo = (s: number) => Math.floor(NOW.getTime() / 1000) - s;

/** history: newest first, like getSignaturesForAddress. */
function fakeRpc(history: Sig[], firstTxAccounts: PublicKey[] = [funder, wallet]): ScreeningRpc & { pages: number } {
  const rpc = {
    pages: 0,
    async getSignaturesForAddress(_a: PublicKey, opts: { limit: number; before?: string }) {
      rpc.pages++;
      const start = opts.before ? history.findIndex((h) => h.signature === opts.before) + 1 : 0;
      return history.slice(start, start + opts.limit);
    },
    async getTransactionAccounts(signature: string) {
      return signature === history.at(-1)?.signature ? { accounts: firstTxAccounts.map((k) => k.toBase58()) } : { accounts: [wallet.toBase58()] };
    },
  };
  return rpc;
}
const sigs = (n: number, oldestAgeSeconds: number): Sig[] =>
  Array.from({ length: n }, (_, i) => ({ signature: `sig${i}`, blockTime: i === n - 1 ? secondsAgo(oldestAgeSeconds) : secondsAgo(10 + i) }));

describe("screenWallet", () => {
  test("sanctioned list is loaded from the JSON file with its source date", () => {
    expect(SANCTIONED.has(SDN.toBase58())).toBe(true);
    expect(SANCTIONED.size).toBe(sanctioned.addresses.length);
    expect(sanctioned.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("passes an established wallet funded by a clean address", async () => {
    const r = await screenWallet(wallet, { rpc: fakeRpc(sigs(5, 30 * 86_400)), now: NOW });
    expect(r.result).toBe("pass");
    expect(r.reasons.join(" ")).toMatch(/30 days/);
  });

  test("flags a wallet on the OFAC SDN list without touching the RPC", async () => {
    const rpc = fakeRpc(sigs(5, 30 * 86_400));
    const r = await screenWallet(SDN, { rpc, now: NOW });
    expect(r.result).toBe("flag");
    expect(r.reasons.join(" ")).toMatch(/OFAC SDN/);
    expect(rpc.pages).toBe(0);
  });

  test("flags a wallet whose first transaction involved a sanctioned address", async () => {
    const r = await screenWallet(wallet, { rpc: fakeRpc(sigs(5, 30 * 86_400), [SDN, wallet]), now: NOW });
    expect(r.result).toBe("flag");
    expect(r.reasons.join(" ")).toMatch(/first transaction.*sanctioned/);
  });

  test("flags a wallet with no on-chain history", async () => {
    const r = await screenWallet(wallet, { rpc: fakeRpc([]), now: NOW });
    expect(r.result).toBe("flag");
    expect(r.reasons.join(" ")).toMatch(/no on-chain history/);
  });

  test("flags a wallet first seen less than 10 minutes ago", async () => {
    const r = await screenWallet(wallet, { rpc: fakeRpc(sigs(2, 5 * 60)), now: NOW });
    expect(r.result).toBe("flag");
    expect(r.reasons.join(" ")).toMatch(/less than 10 minutes/);
  });

  test("passes a wallet first seen 11 minutes ago", async () => {
    const r = await screenWallet(wallet, { rpc: fakeRpc(sigs(2, 11 * 60)), now: NOW });
    expect(r.result).toBe("pass");
  });

  test("walks history pages to find the first transaction", async () => {
    const rpc = fakeRpc(sigs(1500, 100 * 86_400));
    const r = await screenWallet(wallet, { rpc, now: NOW });
    expect(rpc.pages).toBe(2);
    expect(r.result).toBe("pass");
    expect(r.reasons.join(" ")).toMatch(/100 days/);
  });

  test("stops after 3 pages for very active wallets and skips the funding check", async () => {
    const rpc = fakeRpc(sigs(3500, 400 * 86_400), [SDN, wallet]);
    const r = await screenWallet(wallet, { rpc, now: NOW });
    expect(rpc.pages).toBe(3);
    expect(r.result).toBe("pass");
    expect(r.reasons.join(" ")).toMatch(/funding source not checked/);
  });

  test("is fail-closed: an RPC failure flags rather than passes", async () => {
    const rpc: ScreeningRpc = { getSignaturesForAddress: async () => { throw new Error("rpc down"); }, getTransactionAccounts: async () => null };
    const r = await screenWallet(wallet, { rpc, now: NOW });
    expect(r.result).toBe("flag");
    expect(r.reasons.join(" ")).toMatch(/could not be screened/);
  });
});

describe("screenWithBudget (the pay flow never waits more than the budget)", () => {
  const slow = (rpc: ScreeningRpc, ms: number): ScreeningRpc => ({
    getSignaturesForAddress: async (a, o) => (await new Promise((r) => setTimeout(r, ms)), rpc.getSignaturesForAddress(a, o)),
    getTransactionAccounts: (s) => rpc.getTransactionAccounts(s),
  });

  test("a sanctioned wallet is flagged synchronously, without touching RPC", async () => {
    const rpc = fakeRpc(sigs(5, 30 * 86_400));
    const r = await screenWithBudget(SDN, { rpc, budgetMs: 50, now: NOW });
    expect(r.result.result).toBe("flag");
    expect(r.late).toBeUndefined();
    expect(rpc.pages).toBe(0);
  });

  test("a check that finishes in time is returned as is", async () => {
    const r = await screenWithBudget(wallet, { rpc: fakeRpc(sigs(5, 30 * 86_400)), budgetMs: 200, now: NOW });
    expect(r.result.result).toBe("pass");
    expect(r.late).toBeUndefined();
  });

  test("a slow check passes provisionally and hands back the late result", async () => {
    const t0 = Date.now();
    const r = await screenWithBudget(wallet, { rpc: slow(fakeRpc(sigs(2, 60)), 150), budgetMs: 30, now: NOW });
    expect(Date.now() - t0).toBeLessThan(120);
    expect(r.result.result).toBe("pass");
    expect(r.result.reasons.join(" ")).toMatch(/provisional/);
    // wallet first seen 60 s ago → the real check flags it after the payment was built
    expect(await r.late).toMatchObject({ result: "flag" });
  });
});
