/**
 * CLI performance benchmark.
 * Runs each command 5 times, captures wall-clock per run, reports median.
 * Writes JSON snapshot to reports/benchmark/latest.json.
 * Uses node dist/cli.js directly — no global install required.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(root, "dist/cli.js");
const outDir = resolve(root, "reports/benchmark");
const outFile = resolve(outDir, "latest.json");
const RUNS = 5;

/** Curated command set: boot, tree build, manifest-miss paths */
const COMMANDS = [
  { label: "aidd --version", args: ["--version"] },
  { label: "aidd --help", args: ["--help"] },
  { label: "aidd status", args: ["status"] },
  { label: "aidd ai list", args: ["ai", "list"] },
];

/** Isolate from project files — commands must work from an empty dir */
const tmpCwd = mkdtempSync(resolve(tmpdir(), "aidd-bench-"));

/** Run a single command invocation; return elapsed ms */
function timeOnce(args) {
  const start = process.hrtime.bigint();
  spawnSync(process.execPath, [cliPath, ...args], {
    cwd: tmpCwd,
    stdio: "pipe",
    // Allow non-zero exit — we measure boot+arg-parse regardless
  });
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

/** Return median of a numeric array (sorted) */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Read CLI version from package.json */
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const cliVersion = pkg.version;

console.log(`Benchmarking @ai-driven-dev/cli v${cliVersion} (${RUNS} runs each)\n`);

const results = [];

for (const cmd of COMMANDS) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const ms = timeOnce(cmd.args);
    runs.push(ms);
    process.stdout.write(".");
  }
  const med = median(runs);
  results.push({
    command: cmd.label,
    medianMs: Math.round(med),
    runs: runs.map((ms) => Math.round(ms)),
    timestamp: new Date().toISOString(),
    cliVersion,
  });
  console.log(
    ` ${cmd.label}: ${Math.round(med)} ms (runs: [${runs.map((ms) => Math.round(ms)).join(", ")}])`
  );
}

// Write latest.json
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nResults written to ${outFile}`);
