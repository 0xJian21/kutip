/**
 * Seed the Session 2 demo data into DATABASE_URL.
 *   pnpm --filter @kutip/db db:seed            skip if already seeded
 *   pnpm --filter @kutip/db db:seed --reset    wipe the demo exporter first (after a rehearsal)
 */
import { connect } from "../src/client";
import { resetDemo, seedDemo } from "./demo";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, close } = connect(url, { max: 1 });
try {
  if (process.argv.includes("--reset")) {
    await resetDemo(db);
    console.log("demo exporter reset");
  }
  console.log(`demo data: ${await seedDemo(db)}`);
} finally {
  await close();
}
