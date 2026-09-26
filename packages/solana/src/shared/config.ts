import { PublicKey, type Keypair } from "@solana/web3.js";
import { USDC_MINT, DEFAULT_CU_PRICE_MICROLAMPORTS } from "./constants";
import { keypairFromSecret } from "./keys";

export type PaymentsConfig = {
  rpcUrl: string;
  feePayer: Keypair;
  usdcMint: PublicKey;
  jupiterApiKey?: string;
  jupiterBaseUrl?: string;
  /** PAYMENTS_SOL_ENABLED (default true). False = USDC-only fallback if Jupiter Swap API v1 is gone. */
  solEnabled: boolean;
  cuPriceMicroLamports: number;
  appUrl: string;
};

const flag = (v: string | undefined, dflt: boolean) => (v === undefined || v === "" ? dflt : !["0", "false", "no", "off"].includes(v.toLowerCase()));

/** Reads env (never logs secrets). Throws on missing required values. */
export function paymentsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentsConfig {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`missing env ${k}`);
    return v;
  };
  return {
    rpcUrl: need("SOLAMI_RPC_URL"),
    feePayer: keypairFromSecret(need("FEE_PAYER_SECRET")),
    usdcMint: new PublicKey(env["USDC_MINT"] || USDC_MINT.toBase58()),
    jupiterApiKey: env["JUPITER_API_KEY"] || undefined,
    jupiterBaseUrl: env["JUPITER_BASE_URL"] || undefined,
    solEnabled: flag(env["PAYMENTS_SOL_ENABLED"], true),
    cuPriceMicroLamports: Number(env["CU_PRICE_MICROLAMPORTS"] || DEFAULT_CU_PRICE_MICROLAMPORTS),
    appUrl: (env["APP_URL"] || "http://localhost:3000").replace(/\/$/, ""),
  };
}

export { flag as envFlag };
