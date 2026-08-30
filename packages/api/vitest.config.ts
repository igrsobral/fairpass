import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://fairpass:fairpass@localhost:5433/fairpass_test";

export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "test-secret-not-for-prod",
    },
    fileParallelism: false,
    hookTimeout: 20_000,
  },
});