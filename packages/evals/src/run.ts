import { runQueryUnderstandingSuite } from "./harness.js";

const suites = [await runQueryUnderstandingSuite()];

let totalPassed = 0;
let totalFailed = 0;

for (const run of suites) {
  totalPassed += run.passed;
  totalFailed += run.failed;
  console.log(
    `[${run.suite}] ${run.passed}/${run.total} passed` +
      (run.failed > 0 ? `  (${run.failed} FAILED)` : ""),
  );
  for (const d of run.details.filter((d) => !d.ok)) {
    console.log(`  ✗ ${d.id}: ${JSON.stringify(d.diff)}`);
  }
}

console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed`);
process.exit(totalFailed > 0 ? 1 : 0);