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
  const client = postgres(url, { prepare: false, max: opts.max ?? 5 });
  return { db: drizzle({ client, schema }), close: () => client.end() };
}

export const MIGRATIONS_FOLDER = new URL("../drizzle", import.meta.url).pathname;
