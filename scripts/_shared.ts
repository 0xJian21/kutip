/** Shared bits for the one-shot scripts: env, connection, keys, DB, the y/N prompt. */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { connect, createStore } from "@kutip/db";
import { connectionFor, keypairFromEnv } from "@kutip/solana";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

process.loadEnvFile(new URL("../.env", import.meta.url).pathname);

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

export const EXPORTER_ID = process.env.DEMO_EXPORTER_ID ?? "exp_teratai";
export const YES = process.argv.includes("--yes");
export const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

export function chain() {
  return {
    connection: connectionFor(env("SOLAMI_RPC_URL")),
    feePayer: keypairFromEnv("FEE_PAYER_SECRET"),
    agent: keypairFromEnv("AGENT_SECRET"),
    usdcMint: new PublicKey(env("USDC_MINT")),
  };
}

export function db() {
  const { db, close } = connect(env("DATABASE_URL"), { max: 1 });
  return { db, close, store: createStore(db, { appUrl: process.env.APP_URL ?? "http://localhost:3000" }) };
}

export const sol = (lamports: number | bigint) => `${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`;

const rl = readline.createInterface({ input: stdin, output: stdout });
/** Print the plan, then wait for `y` (or --yes, when the user confirmed the printed plan out-of-band). */
export async function confirmOrAbort(lines: string[]): Promise<void> {
  console.log("\n  ABOUT TO WRITE TO MAINNET:");
  for (const l of lines) console.log("    " + l);
  const answer = YES ? "y" : await rl.question("  proceed? [y/N] ").catch(() => "n"); // closed stdin = no
  if (answer.trim() !== "y") {
    console.log("aborted; nothing written");
    process.exit(1);
  }
}
export const closePrompt = () => rl.close();
