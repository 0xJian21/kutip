import "server-only";
import { connect, createStore, type Store } from "@kutip/db";

declare global {
  var __kutipStore: Store | undefined;
}

/**
 * The one @kutip/db store for owner pages, server actions and treasury routes.
 * On globalThis so `next dev` HMR and warm serverless instances reuse the pool.
 * DATABASE_URL on Vercel = Supabase transaction pooler (port 6543); connect() sets prepare:false.
 */
export function store(): Store {
  if (globalThis.__kutipStore) return globalThis.__kutipStore;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("missing env DATABASE_URL");
  // A page fires 5 to 9 independent queries at once; with fewer connections they queue in waves.
  // The BNM rate changes once a day (the worker records it at noon), so it is kept for a minute.
  globalThis.__kutipStore = createStore(connect(url, { max: 10 }).db, { appUrl: appUrl(), rateTtlMs: 60_000 });
  return globalThis.__kutipStore;
}

/** Public https origin (wallets fetch the Solana Pay icon from it; pay links and QRs embed it). */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
