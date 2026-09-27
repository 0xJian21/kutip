/**
 * What the browser sees: joins Realtime Broadcast topics with the public anon key and prints every message.
 *   pnpm --filter @kutip/worker exec tsx --env-file=../../.env scripts/watch-realtime.ts invoice:<invoiceId> [owner:<exporterId>] [--seconds 120]
 * Read-only. Also checks that the anon key still reads no table rows.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const seconds = Number(args[args.indexOf("--seconds") + 1] || 120);
const topics = args.filter((a) => a.includes(":"));
if (!topics.length) throw new Error("usage: watch-realtime.ts invoice:<id> [owner:<exporterId>] [--seconds N]");

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
const supabase = createClient(url, anon);

for (const table of ["invoices", "payments", "agent_actions", "quotes"]) {
  const { data, error } = await supabase.from(table).select("id").limit(1);
  console.log(`anon read ${table}: ${error ? `error ${error.code}` : `${data.length} rows`}`);
}

const t0 = Date.now();
for (const topic of topics) {
  supabase
    .channel(topic)
    .on("broadcast", { event: "*" }, (m) => console.log(`${new Date().toISOString()} +${Date.now() - t0} ms ${topic} ${m.event} ${JSON.stringify(m.payload)}`))
    .subscribe((status, err) => console.log(`${new Date().toISOString()} ${topic}: ${status}${err ? ` ${err.message}` : ""}`));
}
setTimeout(() => process.exit(0), seconds * 1000);
