import bs58 from "bs58";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { fromGrpc, fromRpc, verifyPayment, type RpcTransaction, type Target } from "./verify";

// Raw getTransaction (encoding "json") results recorded from mainnet; see fixtures/README.md.
const fixture = (name: string): RpcTransaction => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const VAULT = "4knsrLskrCc1KBmQ5baYEBkaXmK73izrA7TNgvqiYDte"; // Spike B buyer vault PDA
const VAULT_ATA = "FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS";
const TEST_BUYER = "8pkfjBaMRU3sMSbDKYcUQ2kKiwM6QiXRzwSXsfVZwLNq";
const PHANTOM = "D7Z7exgV9xCAWEBgBKRAUrXYug135D8ADYL6QZJ9AxYR";
const SOLFLARE = "GSKNT5PwGNr6Anzq8FoswdKmTeeSGqA9QyDBLuZsk32e";

const target = (over: Partial<Target> = {}): Target => ({
  amountUsdc: 100_000n, receivedUsdc: 0n, memoCode: "k_test01", vault: VAULT, vaultUsdcAta: VAULT_ATA, ...over,
});
const verify = (name: string, t: Target = target(), quote?: Parameters<typeof verifyPayment>[2]["quote"]) =>
  verifyPayment(fromRpc(fixture(name)), t, { usdcMint: USDC, quote });

describe("direct USDC payments", () => {
  test("Spike C: exact amount, right mint, destination and memo → verified", () => {
    expect(verify("spike-c-usdc")).toEqual({ verified: true, issues: [], amount: 100_000n, payer: TEST_BUYER });
  });

  test.each([
    ["spike-a-usdc-solflare", SOLFLARE],
    ["spike-a-usdc-phantom", PHANTOM],
  ])("Spike A %s: the payer is the buyer wallet, not the fee payer", (name, payer) => {
    expect(verify(name)).toEqual({ verified: true, issues: [], amount: 100_000n, payer });
  });

  test("Session 3 x402 bot payment verifies against its own memo", () => {
    expect(verify("session3-x402-bot", target({ memoCode: "k_jn48bseb" }))).toMatchObject({ verified: true, issues: [], amount: 100_000n, payer: TEST_BUYER });
  });

  test("partial payment is verified and flagged", () => {
    expect(verify("spike-c-usdc", target({ amountUsdc: 250_000n }))).toMatchObject({
      verified: true, amount: 100_000n, issues: ["Amount is less than the invoice total: USD 0.10 received, USD 0.25 due"],
    });
  });

  test("the expected amount is what is still due after earlier payments", () => {
    expect(verify("spike-c-usdc", target({ amountUsdc: 250_000n, receivedUsdc: 150_000n }))).toMatchObject({ verified: true, issues: [] });
  });

  test("overpayment is verified and flagged", () => {
    expect(verify("spike-c-usdc", target({ amountUsdc: 40_000n }))).toMatchObject({
      verified: true, amount: 100_000n, issues: ["Amount is more than the invoice total: USD 0.10 received, USD 0.04 due"],
    });
  });

  test("wrong or missing memo → not verified", () => {
    expect(verify("spike-c-usdc", target({ memoCode: "k_other" }))).toMatchObject({ verified: false, issues: ['Memo "k_test01" does not match k_other'] });
  });

  test("USDC to another account → not verified", () => {
    expect(verify("spike-c-usdc", target({ vaultUsdcAta: "11111111111111111111111111111111" }))).toMatchObject({
      verified: false, amount: 0n, issues: ["No USDC reached the buyer vault"],
    });
  });

  test("the vault's ATA must belong to the buyer vault", () => {
    expect(verify("spike-c-usdc", target({ vault: "11111111111111111111111111111111" }))).toMatchObject({
      verified: false, issues: [`Destination account is owned by ${VAULT}, not the buyer vault`],
    });
  });

  test("a look-alike mint credited to the vault → not verified", () => {
    const tx = fixture("spike-c-usdc");
    const fake = "FakeUSDC1111111111111111111111111111111111";
    for (const b of [...tx.meta.preTokenBalances, ...tx.meta.postTokenBalances]) b.mint = fake;
    expect(verifyPayment(fromRpc(tx), target(), { usdcMint: USDC })).toMatchObject({
      verified: false, amount: 0n, issues: [`Look-alike token ${fake} sent instead of USDC`, "No USDC reached the buyer vault"],
    });
  });

  test("a failed transaction → not verified", () => {
    const tx = fixture("spike-c-usdc");
    tx.meta.err = { InstructionError: [2, "Custom"] };
    expect(verifyPayment(fromRpc(tx), target(), { usdcMint: USDC })).toMatchObject({ verified: false, issues: ["Transaction failed on-chain"] });
  });

  test("a sweep out of the vault is not a payment", () => {
    expect(verify("spike-b-sweep")).toMatchObject({ verified: false, amount: 0n });
  });
});

describe("swap payments (Jupiter ExactOut)", () => {
  const swapTarget = target({ amountUsdc: 500_000n });

  test.each([
    ["spike-a-swap-phantom", PHANTOM, 4_128_768n],
    ["spike-a-swap-solflare", SOLFLARE, 4_120_304n],
  ])("%s: input token and amount come from the payer's balance deltas", (name, payer, lamports) => {
    expect(verify(name, swapTarget)).toEqual({ verified: true, issues: [], amount: 500_000n, payer, inputMint: "SOL", inputAmount: lamports });
  });

  test("the stored quote is copied onto the receipt", () => {
    const quote = { inputMint: "SOL" as const, quotedInput: 4_120_000n, quotedOut: 500_000n };
    expect(verify("spike-a-swap-phantom", swapTarget, quote)).toMatchObject({ inputAmount: 4_128_768n, quotedInput: 4_120_000n, quotedOut: 500_000n });
  });
});

describe("gRPC and RPC shapes", () => {
  // The listener sees Yellowstone's protobuf shape; backfill sees getTransaction JSON. Both must read the same.
  function toGrpc(tx: RpcTransaction) {
    const m = tx.transaction.message;
    const b = (k: string) => bs58.decode(k);
    const tb = (x: RpcTransaction["meta"]["preTokenBalances"][number]) => ({ accountIndex: x.accountIndex, mint: x.mint, owner: x.owner ?? "", programId: "", uiTokenAmount: { amount: x.uiTokenAmount.amount, decimals: 6, uiAmount: 0, uiAmountString: "" } });
    return {
      signature: b(tx.transaction.signatures[0]!),
      isVote: false,
      index: "0",
      transaction: {
        signatures: tx.transaction.signatures.map(b),
        message: {
          header: m.header,
          accountKeys: m.accountKeys.map(b),
          recentBlockhash: new Uint8Array(32),
          instructions: m.instructions.map((ix) => ({ programIdIndex: ix.programIdIndex, accounts: Uint8Array.from(ix.accounts), data: bs58.decode(ix.data) })),
          versioned: tx.version !== "legacy",
          addressTableLookups: [],
        },
      },
      meta: {
        err: tx.meta.err ? { err: new Uint8Array([1]) } : undefined,
        fee: String(tx.meta.fee),
        preBalances: tx.meta.preBalances.map(String),
        postBalances: tx.meta.postBalances.map(String),
        preTokenBalances: tx.meta.preTokenBalances.map(tb),
        postTokenBalances: tx.meta.postTokenBalances.map(tb),
        loadedWritableAddresses: (tx.meta.loadedAddresses?.writable ?? []).map(b),
        loadedReadonlyAddresses: (tx.meta.loadedAddresses?.readonly ?? []).map(b),
      },
    };
  }

  test.each(["spike-c-usdc", "spike-a-swap-phantom", "spike-a-usdc-solflare"])("%s reads the same from both", (name) => {
    const tx = fixture(name);
    expect(fromGrpc(tx.slot, toGrpc(tx) as unknown as Parameters<typeof fromGrpc>[1])).toEqual(fromRpc(tx));
  });
});
