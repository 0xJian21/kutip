/**
 * Jupiter Swap API v1 (Metis) client, pinned. ExactOut exists only on v1
 * (Swap API v2 /build is ExactIn-only; verified 2026-09-27). No decommission
 * date is announced; if v1 disappears, PAYMENTS_SOL_ENABLED=false keeps USDC-only.
 * Docs: https://developers.jup.ag/docs/swap/payments-through-swap
 */

export type JupiterQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: bigint;
  outAmount: bigint;
  /** Raw quote, passed back verbatim to /swap-instructions. */
  raw: Record<string, unknown>;
};

export type JupiterInstruction = { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };

export type JupiterSwapInstructions = {
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction: JupiterInstruction | null;
  otherInstructions: JupiterInstruction[];
  addressLookupTableAddresses: string[];
  computeUnitLimit?: number;
  simulationError?: unknown;
};

export type JupiterClient = {
  quoteExactOut(p: { inputMint: string; outputMint: string; amountOut: bigint; slippageBps?: number }): Promise<JupiterQuote>;
  swapInstructions(p: { quote: JupiterQuote; userPublicKey: string; destinationTokenAccount: string; trackingAccount: string }): Promise<JupiterSwapInstructions>;
};

/** Enough headroom for a v0 tx with 1 LUT plus our memo + reference (spike A: 854–889 B at 24). */
export const JUPITER_MAX_ACCOUNTS = 24;

export function jupiterClient(opts: { baseUrl?: string; apiKey?: string; fetch?: typeof globalThis.fetch } = {}): JupiterClient {
  const base = (opts.baseUrl ?? "https://api.jup.ag").replace(/\/$/, "");
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchFn(`${base}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) } });
    const body = (await res.json().catch(() => ({}))) as { error?: string; errorCode?: string };
    if (!res.ok || body.error) throw new Error(`jupiter ${path} HTTP ${res.status}: ${body.error ?? body.errorCode ?? "unknown error"}`);
    return body as T;
  }

  return {
    async quoteExactOut({ inputMint, outputMint, amountOut, slippageBps = 50 }) {
      const qs = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountOut.toString(),
        swapMode: "ExactOut",
        slippageBps: String(slippageBps),
        maxAccounts: String(JUPITER_MAX_ACCOUNTS),
        restrictIntermediateTokens: "true",
      });
      const raw = await call<Record<string, unknown> & { inAmount: string; outAmount: string; inputMint: string; outputMint: string }>(`/swap/v1/quote?${qs}`);
      const out = BigInt(raw.outAmount);
      if (out !== amountOut) throw new Error(`jupiter quote outAmount ${out} != requested ${amountOut}`);
      return { inputMint: raw.inputMint, outputMint: raw.outputMint, inAmount: BigInt(raw.inAmount), outAmount: out, raw };
    },
    swapInstructions({ quote, userPublicKey, destinationTokenAccount, trackingAccount }) {
      return call<JupiterSwapInstructions>("/swap/v1/swap-instructions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote.raw,
          userPublicKey,
          destinationTokenAccount, // assumed initialised by Jupiter → no ATA creation
          trackingAccount, // appended read-only to the swap ix: our Solana Pay reference
          wrapAndUnwrapSol: true, // buyer funds a temp wSOL account, closed by cleanup
          dynamicComputeUnitLimit: true,
          // never `payer`: it would make the fee payer the rent payer of setup accounts (D4)
        }),
      });
    },
  };
}
