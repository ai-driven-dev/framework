#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_ROOT = join(CLI_ROOT, "reports", "mutation");

/** The two paths stryker.conf.json writes, before they are filed by scope. */
const WRITTEN_REPORTS = ["report.html", "mutation.json"];

function loadScopes(root = CLI_ROOT) {
  return JSON.parse(readFileSync(join(root, "mutation-scopes.json"), "utf8")).scopes;
}

/** One incremental file per scope: what a run learned about `kernel` says nothing about
 * `tools`, and a shared file would let one scope's result skip another's mutants. */
export function strykerArgs(scope, scopes, { force = false } = {}) {
  const declared = scopes[scope];
  if (declared === undefined) {
    throw new Error(`Unknown scope "${scope}". Scopes: ${Object.keys(scopes).join(", ")}`);
  }
  const args = [
    "run",
    "--mutate",
    [declared.mutate].flat().join(","),
    "--incremental",
    "--incrementalFile",
    `reports/mutation/${scope}/incremental.json`,
  ];
  if (force) args.push("--force");
  return args;
}

/** Stryker's own score: detected (killed, timed out) over detected plus undetected (survived,
 * uncovered); an ignored or errored mutant counts on neither side. No mutant scores zero. */
export function scoreOf(report) {
  let detected = 0;
  let undetected = 0;
  for (const file of Object.values(report.files ?? {})) {
    for (const mutant of file.mutants) {
      if (mutant.status === "Killed" || mutant.status === "Timeout") detected += 1;
      else if (mutant.status === "Survived" || mutant.status === "NoCoverage") undetected += 1;
    }
  }
  const total = detected + undetected;
  return total === 0 ? 0 : (100 * detected) / total;
}

/** Stryker reuses an incremental result unless the mutant's file or a test that covered it
 * changed, so a test written after the fact never reaches a mutant recorded as survived,
 * uncovered or static: those rerun every time, and only a kill is carried forward. */
export function pruneIncremental(report) {
  const files = {};
  for (const [name, file] of Object.entries(report.files ?? {})) {
    files[name] = {
      ...file,
      mutants: file.mutants.filter((mutant) => !mutant.static && mutant.status === "Killed"),
    };
  }
  return { ...report, files };
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** The lines a `git diff -U0` adds or changes under `src/`, as stryker `file:start-end` ranges.
 * A pure deletion adds no line to mutate, and a file outside `src/` belongs to no scope. */
export function changedRanges(diff) {
  const ranges = [];
  let file = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4);
      file = target.startsWith("b/") ? target.slice(2) : null;
      continue;
    }
    const hunk = HUNK.exec(line);
    if (hunk === null || file === null || !file.startsWith("src/") || !file.endsWith(".ts"))
      continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count > 0) ranges.push(`${file}:${start}-${start + count - 1}`);
  }
  return ranges;
}

/** No scope, no incremental file and no floor: a check on a branch must never move a gate. */
export function changedArgs(ranges) {
  return ["run", "--mutate", ranges.join(",")];
}

export function survivorsOf(report) {
  const survivors = [];
  for (const [name, file] of Object.entries(report.files ?? {})) {
    for (const mutant of file.mutants) {
      if (mutant.status !== "Survived" && mutant.status !== "NoCoverage") continue;
      survivors.push(
        `${name}:${mutant.location.start.line} ${mutant.mutatorName} (${mutant.status})`
      );
    }
  }
  return survivors;
}

/** Below the declared floor is a failure the run itself raises; stryker's own `thresholds`
 * would need a config file per scope to say the same thing. */
export function breakVerdict(score, declared) {
  if (score < declared.break) {
    return `mutation score ${score.toFixed(1)} is below the ${declared.break} declared in mutation-scopes.json`;
  }
  return null;
}

/** Reads first rather than checking first: a file that vanishes in between is simply absent. */
function pruneIncrementalFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  writeFileSync(path, JSON.stringify(pruneIncremental(JSON.parse(raw))));
}

function usage(problem, scopes) {
  console.error(
    `${problem}\n\nUsage: node scripts/run-mutation.mjs <scope> [--force]\n       node scripts/run-mutation.mjs --changed [<base>]`
  );
  console.error(`Scopes: ${Object.keys(scopes).join(", ")}`);
  process.exit(1);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: CLI_ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function fileReports(dir) {
  for (const name of WRITTEN_REPORTS) {
    const written = join(REPORT_ROOT, name);
    if (existsSync(written)) renameSync(written, join(dir, name));
  }
}

function mainChanged(base = "origin/next") {
  const mergeBase = git(["merge-base", base, "HEAD"]);
  const ranges = changedRanges(git(["diff", "-U0", "--relative", mergeBase, "--", "src"]));
  if (ranges.length === 0) {
    console.log(`No line under src/ changed since ${base}: nothing to mutate.`);
    return;
  }
  const dir = join(REPORT_ROOT, "changed");
  mkdirSync(dir, { recursive: true });
  const result = spawnSync(join(CLI_ROOT, "node_modules", ".bin", "stryker"), changedArgs(ranges), {
    cwd: CLI_ROOT,
    stdio: "inherit",
  });
  rmSync(join(CLI_ROOT, ".stryker-tmp"), { recursive: true, force: true });
  fileReports(dir);
  if (result.status !== 0) process.exit(result.status ?? 1);
  const report = JSON.parse(readFileSync(join(dir, "mutation.json"), "utf8"));
  const mutants = Object.values(report.files ?? {}).flatMap((file) => file.mutants).length;
  const measured =
    mutants === 0 ? "no mutant on those lines" : `score ${scoreOf(report).toFixed(1)}`;
  console.log(
    `\nReport: reports/mutation/changed/ (${measured}, ${ranges.length} changed range(s) since ${base})`
  );
  for (const survivor of survivorsOf(report)) console.log(`  survived: ${survivor}`);
}

function main() {
  const scopes = loadScopes();
  const [scope, ...flags] = process.argv.slice(2);
  if (scope === "--changed") return mainChanged(flags[0]);
  if (scope === undefined) usage("No scope given.", scopes);
  if (!Object.hasOwn(scopes, scope)) usage(`Unknown scope "${scope}".`, scopes);
  const force = flags.includes("--force");

  const scopeDir = join(REPORT_ROOT, scope);
  mkdirSync(scopeDir, { recursive: true });
  pruneIncrementalFile(join(scopeDir, "incremental.json"));

  const result = spawnSync(
    join(CLI_ROOT, "node_modules", ".bin", "stryker"),
    strykerArgs(scope, scopes, { force }),
    { cwd: CLI_ROOT, stdio: "inherit" }
  );

  // A sandbox survives an interrupted run and they grow to hundreds of megabytes.
  rmSync(join(CLI_ROOT, ".stryker-tmp"), { recursive: true, force: true });

  fileReports(scopeDir);

  if (result.status !== 0) process.exit(result.status ?? 1);

  const report = JSON.parse(readFileSync(join(scopeDir, "mutation.json"), "utf8"));
  const score = scoreOf(report);
  const verdict = breakVerdict(score, scopes[scope]);
  console.log(
    `\nReport: reports/mutation/${scope}/ (score ${score.toFixed(1)}, floor ${scopes[scope].break})`
  );
  if (verdict !== null) {
    console.error(verdict);
    process.exit(1);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
