import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { testDb } from "./testing/pglite";

test("migrations apply on plain Postgres and create every table with RLS on", async () => {
  const db = await testDb();
  const result = (await db.execute(
    sql`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
  )) as unknown as { rows: Array<{ relname: string; relrowsecurity: boolean }> };
  expect(result.rows).toEqual(
    ["agent_actions", "buyers", "exporters", "fx_rates", "invoices", "messages", "payments", "screenings", "sweeps", "users"].map(
      (relname) => ({ relname, relrowsecurity: true }),
    ),
  );
});
