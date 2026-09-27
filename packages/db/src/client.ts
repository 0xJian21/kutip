import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Any Drizzle Postgres database over this schema (postgres-js in prod, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Connect to Supabase Postgres. `prepare: false` keeps it working behind the
 * transaction pooler (port 6543), which serverless routes should use.
 */
export function connect(url: string, opts: { max?: number } = {}): { db: Db; close: () => Promise<void> } {
  // One line per server notice (e.g. Realtime's "no partition" warning when no client has connected yet).
  const client = postgres(url, { prepare: false, max: opts.max ?? 5, onnotice: (n) => console.warn(`postgres ${n.severity}: ${n.message}`) });
  return { db: drizzle({ client, schema }), close: () => client.end() };
}

// Not `new URL("../drizzle", import.meta.url)`: bundlers (Next/Turbopack) treat that pattern as an asset reference and fail.
export const MIGRATIONS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
