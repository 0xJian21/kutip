/** Apply drizzle/ migrations to DATABASE_URL: pnpm --filter @kutip/db db:migrate */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connect, MIGRATIONS_FOLDER } from "./client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, close } = connect(url, { max: 1 });
try {
  await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("migrations applied");
} finally {
  await close();
}
