import "server-only";
import { connectionFor, keypairFromEnv } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { sessionOrThrow } from "@/lib/server/auth";
import { store } from "@/lib/server/store";

/** Server-side treasury context for the API routes; the exporter comes from the owner's session. */
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

let cached: ReturnType<typeof build> | undefined;
function build() {
  return {
    connection: connectionFor(env("SOLAMI_RPC_URL")),
    feePayer: keypairFromEnv("FEE_PAYER_SECRET"),
    usdcMint: new PublicKey(env("USDC_MINT")),
  };
}
export function treasuryContext() {
  return { store: store(), ...(cached ??= build()) };
}

export async function treasuryMultisig(): Promise<{ exporterId: string; multisig: PublicKey; wallet?: string }> {
  const { exporterId, wallet } = await sessionOrThrow();
  const exporter = await store().getExporter(exporterId);
  if (!exporter) throw new Error(`exporter not found: ${exporterId}`);
  return { exporterId, wallet, multisig: new PublicKey(exporter.treasuryMultisig) };
}

/** Route helper: JSON with a status, bigints as strings. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), { status, headers: { "content-type": "application/json" } });
}

export function pubkey(value: unknown, what: string): PublicKey {
  try {
    return new PublicKey(String(value));
  } catch {
    throw new Error(`${what} is not a valid public key`);
  }
}
