import postgres from "postgres";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://fairpass:fairpass@localhost:5433/fairpass_test";

export const testSql = postgres(TEST_DATABASE_URL, { max: 5 });

const TABLES = [
  "users",
  "venues",
  "events",
  "event_dates",
  "ticket_listings",
  "orders",
  "conversations",
  "messages",
  "smart_alerts",
  "verification_results",
  "seller_trust_scores",
];

export async function resetDatabase(): Promise<void> {
  await testSql.unsafe(
    `truncate table ${TABLES.join(", ")} restart identity cascade`,
  );
}

export async function closeTestDb(): Promise<void> {
  await testSql.end();
}