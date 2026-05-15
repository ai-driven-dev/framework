/**
 * Performance regression checker.
 * Compares reports/benchmark/latest.json against scripts/perf-baseline.json.
 *
 * Exit codes:
 *   0 — all within threshold (or improvement detected)
 *   1 — hard regression: at least one command is >50% slower than baseline
 *
 * Thresholds:
 *   >20% slower → WARN  (exit 0)
 *   >50% slower → FAIL  (exit 1)
 *    >5% faster → NOTE  (suggest baseline update)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = resolve(root, "scripts/perf-baseline.json");
const latestPath = resolve(root, "reports/benchmark/latest.json");

const WARN_THRESHOLD = 0.2;
const FAIL_THRESHOLD = 0.5;
const IMPROVE_THRESHOLD = 0.05;

let baseline, latest;

try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  console.error(`ERROR: cannot read baseline: ${baselinePath}`);
  console.error("Run 'pnpm bench' first, then copy output to scripts/perf-baseline.json");
  process.exit(1);
}

try {
  latest = JSON.parse(readFileSync(latestPath, "utf8"));
} catch {
  console.error(`ERROR: cannot read latest benchmark: ${latestPath}`);
  console.error("Run 'pnpm bench' to generate it");
  process.exit(1);
}

/** Build lookup map from latest results */
const latestMap = new Map(latest.map((r) => [r.command, r.medianMs]));

let hasHardFailure = false;
let hasWarning = false;
let hasImprovement = false;

console.log("\nPerformance regression check\n");
console.log(
  `${"Command".padEnd(30)} ${"Baseline".padStart(10)} ${"Latest".padStart(10)} ${"Delta".padStart(10)} ${"Status".padStart(8)}`
);
console.log("-".repeat(72));

for (const base of baseline) {
  const latestMs = latestMap.get(base.command);

  if (latestMs === undefined) {
    console.log(
      `${base.command.padEnd(30)} ${"—".padStart(10)} ${"missing".padStart(10)} ${"—".padStart(10)} ${"SKIP".padStart(8)}`
    );
    continue;
  }

  const delta = (latestMs - base.medianMs) / base.medianMs;
  const deltaPct = (delta * 100).toFixed(1);
  const sign = delta >= 0 ? "+" : "";
  let status;

  if (delta > FAIL_THRESHOLD) {
    status = "FAIL";
    hasHardFailure = true;
  } else if (delta > WARN_THRESHOLD) {
    status = "WARN";
    hasWarning = true;
  } else if (delta < -IMPROVE_THRESHOLD) {
    status = "NOTE";
    hasImprovement = true;
  } else {
    status = "PASS";
  }

  console.log(
    `${base.command.padEnd(30)} ${`${base.medianMs} ms`.padStart(10)} ${`${latestMs} ms`.padStart(10)} ${`${sign}${deltaPct}%`.padStart(10)} ${status.padStart(8)}`
  );
}

console.log("-".repeat(72));

if (hasHardFailure) {
  console.error("\nFAIL: one or more commands regressed beyond 50% threshold.");
  console.error("Investigate recent changes for synchronous I/O or eager module loading.");
  process.exit(1);
}

if (hasWarning) {
  console.warn("\nWARN: one or more commands are 20-50% slower than baseline.");
  console.warn("Not a hard failure, but worth investigating.");
}

if (hasImprovement) {
  console.log("\nNOTE: one or more commands improved by >5%.");
  console.log(
    "Consider updating the baseline: copy reports/benchmark/latest.json to scripts/perf-baseline.json"
  );
}

if (!hasHardFailure && !hasWarning && !hasImprovement) {
  console.log("\nPASS: all commands within baseline thresholds.");
}
