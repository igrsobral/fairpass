import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://fairpass:fairpass@localhost:5433/fairpass";

export const sql = postgres(DATABASE_URL, {
  max: 10,
  connection: {
    application_name: "fairpass-api",
  },
});

export const db = drizzle(sql, { schema });

export async function pingDb(): Promise<boolean> {
  const result = await sql`select 1 as ok`;
  return result[0]?.ok === 1;
}