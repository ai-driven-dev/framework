#!/usr/bin/env node
/**
 * Copies between two tool profiles, checked before push. The CI-wide `pnpm jscpd` reads all of
 * src/ against one percentage, so a copy between two profiles hides in the average.
 *
 * Measured on the profiles: their `build.ts` and `profile.ts` declare a tool's contract as
 * object literals, and every one looks like every other (52 clones at 30 tokens, none of them
 * logic). No block size separates them from the real copies, merge and bridge code of 47 to 60
 * tokens, so those two files are left out and the rest is read with identifiers and literals
 * ignored, which is what makes a renamed merge loop a copy. A copy within one tool's folder is
 * not a copy between profiles.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILES = join(CLI_ROOT, "src/contexts/tools/domain/profiles");
const JSCPD = join(CLI_ROOT, "node_modules/jscpd/run-jscpd.js");

export const JSCPD_ARGS = [
  "--min-lines",
  "5",
  "--min-tokens",
  "40",
  "--ignore-identifiers",
  "--ignore-literals",
  "--ignore",
  "**/build.ts,**/profile.ts",
];

/**
 * Copies between two profiles today, by file pair, with the number of clones. The list may
 * only shrink: a new pair fails, and so does a pair whose count changed.
 */
export const BASELINE = [
  {
    pair: "codex/hooks-format.ts <> cursor/hooks-format.ts",
    clones: 1,
    reason: "each profile merges a plugin's hooks into the tool's file with its own loop",
  },
  {
    pair: "copilot/hooks-format.ts <> cursor/hooks-format.ts",
    clones: 1,
    reason: "each profile flattens a matcher group into entries with its own loop",
  },
  {
    pair: "kilo/kilo-hooks-bridge.ts <> opencode/opencode-hooks-bridge.ts",
    clones: 1,
    reason: "each bridge parses a hook command into its script and arguments on its own",
  },
];

/** `<a> <> <b> (<clones>)` per pair of files in two different tool folders, from a jscpd
 * JSON report whose names are relative to the folder it scanned. */
export function copiesBetweenProfiles(report) {
  const pairs = new Map();
  for (const duplicate of report.duplicates) {
    const [first, second] = [duplicate.firstFile.name, duplicate.secondFile.name]
      .map((name) => name.replace(/\\/g, "/"))
      .sort();
    if (first.split("/")[0] === second.split("/")[0]) continue;
    const pair = `${first} <> ${second}`;
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  return [...pairs].map(([pair, clones]) => `${pair} (${clones})`).sort();
}

/** Runs jscpd over `dir` with this check's settings and returns its JSON report. */
export function scan(dir, launcher = JSCPD) {
  const out = mkdtempSync(join(tmpdir(), "aidd-profile-copies-"));
  try {
    const result = spawnSync(
      process.execPath,
      [launcher, dir, ...JSCPD_ARGS, "--reporters", "json", "--output", out, "--silent"],
      { cwd: dir, encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(`jscpd did not run: ${result.error?.message ?? result.stderr}`);
    }
    return JSON.parse(readFileSync(join(out, "jscpd-report.json"), "utf8"));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** What the baseline does not hold, and what it holds that is gone. */
export function compare(current, baseline = BASELINE) {
  const base = new Set(baseline.map((entry) => `${entry.pair} (${entry.clones})`));
  const now = new Set(current);
  return {
    added: current.filter((entry) => !base.has(entry)),
    fixed: [...base].filter((entry) => !now.has(entry)),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { added, fixed } = compare(copiesBetweenProfiles(scan(PROFILES)));
  for (const entry of added) console.error(`copy between profiles: ${entry}`);
  for (const entry of fixed) console.error(`gone or changed, update BASELINE: ${entry}`);
  if (added.length > 0 || fixed.length > 0) process.exit(1);
  console.log("no copy between profiles beyond the baseline");
}
