import { describe, expect, test } from "vitest";
import { jupiterClient, type JupiterSwapInstructions } from "./jupiter";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

type Call = { url: string; init?: RequestInit };
function fakeFetch(handler: (call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: url.toString(), init };
    calls.push(call);
    const { status, body } = handler(call);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const quoteBody = { inputMint: SOL, outputMint: USDC, inAmount: "4139555", outAmount: "500000", swapMode: "ExactOut", routePlan: [] };
const swapBody: JupiterSwapInstructions = {
  computeBudgetInstructions: [],
  setupInstructions: [],
  swapInstruction: { programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", accounts: [], data: "" },
  cleanupInstruction: null,
  otherInstructions: [],
  addressLookupTableAddresses: [],
  computeUnitLimit: 300_000,
};

describe("jupiterClient (Swap API v1, pinned)", () => {
  test("quoteExactOut hits /swap/v1/quote with ExactOut, maxAccounts=24 and the api key", async () => {
    const f = fakeFetch(() => ({ status: 200, body: quoteBody }));
    const jup = jupiterClient({ apiKey: "k-test", fetch: f.fetch });
    const q = await jup.quoteExactOut({ inputMint: SOL, outputMint: USDC, amountOut: 500_000n });
    const u = new URL(f.calls[0]!.url);
    expect(u.origin + u.pathname).toBe("https://api.jup.ag/swap/v1/quote");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ inputMint: SOL, outputMint: USDC, amount: "500000", swapMode: "ExactOut", maxAccounts: "24", restrictIntermediateTokens: "true" });
    expect((f.calls[0]!.init?.headers as Record<string, string>)["x-api-key"]).toBe("k-test");
    expect(q.inAmount).toBe(4_139_555n);
    expect(q.outAmount).toBe(500_000n);
  });

  test("quoteExactOut rejects a quote whose outAmount is not the requested amount", async () => {
    const f = fakeFetch(() => ({ status: 200, body: { ...quoteBody, outAmount: "499999" } }));
    await expect(jupiterClient({ fetch: f.fetch }).quoteExactOut({ inputMint: SOL, outputMint: USDC, amountOut: 500_000n })).rejects.toThrow(/outAmount/);
  });

  test("surfaces Jupiter errors with status and message", async () => {
    const f = fakeFetch(() => ({ status: 400, body: { error: "Could not find any route", errorCode: "COULD_NOT_FIND_ANY_ROUTE" } }));
    await expect(jupiterClient({ fetch: f.fetch }).quoteExactOut({ inputMint: SOL, outputMint: USDC, amountOut: 1n })).rejects.toThrow(/400.*Could not find any route/);
  });

  test("swapInstructions posts quote, user, destination ATA and tracking account; never a payer", async () => {
    const f = fakeFetch((c) => (c.url.includes("/quote?") ? { status: 200, body: quoteBody } : { status: 200, body: swapBody }));
    const jup = jupiterClient({ fetch: f.fetch });
    const q = await jup.quoteExactOut({ inputMint: SOL, outputMint: USDC, amountOut: 500_000n });
    const s = await jup.swapInstructions({ quote: q, userPublicKey: "user", destinationTokenAccount: "dest", trackingAccount: "ref" });
    const call = f.calls[1]!;
    expect(new URL(call.url).pathname).toBe("/swap/v1/swap-instructions");
    const body = JSON.parse(call.init?.body as string);
    expect(body).toMatchObject({ quoteResponse: quoteBody, userPublicKey: "user", destinationTokenAccount: "dest", trackingAccount: "ref", wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true });
    expect(body).not.toHaveProperty("payer");
    expect(s.computeUnitLimit).toBe(300_000);
  });
});
