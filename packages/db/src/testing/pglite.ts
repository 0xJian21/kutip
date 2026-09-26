import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_FOLDER, type Db } from "../client";
import * as schema from "../schema";

/**
 * Fresh in-memory Postgres with every migration applied. A stand-in for
 * Supabase's realtime.send records broadcasts in realtime.sent, so the
 * broadcast-trigger migration installs here too and can be tested.
 */
export async function testDb(): Promise<Db> {
  const client = new PGlite();
  await client.exec(`
    create schema realtime;
    create table realtime.sent (id serial primary key, topic text, event text, payload jsonb, private boolean);
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
      language sql as $$ insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private) $$;
  `);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
