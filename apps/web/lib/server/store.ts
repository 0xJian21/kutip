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
  globalThis.__kutipStore = createStore(connect(url, { max: 3 }).db, { appUrl: appUrl() });
  return globalThis.__kutipStore;
}

/** Public https origin (wallets fetch the Solana Pay icon from it; pay links and QRs embed it). */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
