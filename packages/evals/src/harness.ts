import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchQuerySchema } from "@fairpass/api";

export interface EvalRun {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  details: Array<{ id: string; ok: boolean; diff?: unknown }>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const fixturesDir = path.resolve(__dirname, "../fixtures");

export async function loadJsonl<T>(name: string): Promise<T[]> {
  const raw = await readFile(path.join(fixturesDir, name), "utf8");
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  // Support both array-JSON files and true JSONL (one object per line).
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as T[];
  }

  return trimmed
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

/**
 * Deterministic harness over the Query-Understanding gold set.
 * Asserts the schema-first contract is parseable and required fields
 * survive. Agent-facing and LLM-judge suites arrive in Phase 5.
 */
export async function runQueryUnderstandingSuite(): Promise<EvalRun> {
  const rows = await loadJsonl<{
    id: string;
    naturalLanguage: string;
    parsed: unknown;
  }>("query-understanding.jsonl");

  const details = rows.map((row) => {
    const result = searchQuerySchema.safeParse(row.parsed);
    return {
      id: row.id,
      ok: result.success,
      diff: result.success ? undefined : result.error.flatten(),
    };
  });

  return summarize("query-understanding", details);
}

export function summarize(
  suite: string,
  details: EvalRun["details"],
): EvalRun {
  const passed = details.filter((d) => d.ok).length;
  return {
    suite,
    total: details.length,
    passed,
    failed: details.length - passed,
    details,
  };
}