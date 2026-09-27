// Deep imports: `@kutip/db`'s index re-exports client.ts, whose top-level
// `new URL("../drizzle", import.meta.url)` Turbopack cannot bundle (see PLAN.md Requests).
import * as schema from "@kutip/db/src/schema";
import { createStore } from "@kutip/db/src/store";
import { connectionFor, keypairFromEnv } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Server-side treasury context for the API routes. The demo exporter id comes
 * from DEMO_EXPORTER_ID until Session 7 derives it from the Privy session.
 */
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

export const EXPORTER_ID = process.env.DEMO_EXPORTER_ID ?? "exp_teratai";

let cached: ReturnType<typeof build> | undefined;
function build() {
  // Same settings as @kutip/db connect(): prepare:false for the Supabase transaction pooler.
  const db = drizzle({ client: postgres(env("DATABASE_URL"), { prepare: false, max: 2 }), schema });
  return {
    store: createStore(db, { appUrl: process.env.APP_URL ?? "http://localhost:3000" }),
    connection: connectionFor(env("SOLAMI_RPC_URL")),
    feePayer: keypairFromEnv("FEE_PAYER_SECRET"),
    usdcMint: new PublicKey(env("USDC_MINT")),
  };
}
export function treasuryContext() {
  return (cached ??= build());
}

export async function treasuryMultisig(): Promise<PublicKey> {
  const { store } = treasuryContext();
  const exporter = await store.getExporter(EXPORTER_ID);
  if (!exporter) throw new Error(`exporter not found: ${EXPORTER_ID}`);
  return new PublicKey(exporter.treasuryMultisig);
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
