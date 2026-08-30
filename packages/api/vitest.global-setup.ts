import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://fairpass:fairpass@localhost:5433/fairpass_test";

export default async function globalSetup(): Promise<void> {
  const adminUrl =
    process.env.POSTGRES_ADMIN_URL ??
    "postgres://fairpass:fairpass@localhost:5433/postgres";

  const admin = postgres(adminUrl, { max: 1 });
  try {
    await admin`create database fairpass_test`;
  } catch {
    // 42P04 duplicate_database — already present.
  }
  await admin.end();

  const pg = postgres(TEST_DATABASE_URL, { max: 5 });
  const db = drizzle(pg, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "./drizzle"),
  });
  await pg.end();
}