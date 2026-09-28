import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!);
console.table(await sql`select invoice_id, direction, status, channel, classification->>'intent' as intent, left(replace(body,E'\n',' '),150) as body from messages where channel='pay_page' order by created_at`);
console.table(await sql`select invoice_id, kind, rule_id, status, left(decision,70) d from agent_actions where created_at > now() - interval '5 minutes' order by created_at`);
console.table(await sql`select id, status from invoices where id in ('inv_0140','inv_0141','inv_0142')`);
await sql.end();
