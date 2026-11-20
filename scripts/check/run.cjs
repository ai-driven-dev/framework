#!/usr/bin/env node
"use strict";
// Usage: node scripts/check/run.cjs [--fix] [--update-baseline] [--root <dir>] [<file>...]
// Checks every artifact each contract names in its `targets` (scripts/check/contracts/*.json and plugins/*/skills/*/scripts/contract.json), and the vendored engine copies.
// With files (relative to root or absolute), checks only the artifacts owning them: the folder holding the file, or the file itself. Files no contract owns are ignored. Baseline staleness is judged only for those artifacts, and engine copies are checked only if a file is under scripts/check/engine/ or a skill's scripts/lib/. --update-baseline takes no files.
// Each generator of scripts/check/generators runs on every full run, and on a scoped run when a given file matches its `watch` globs: a stale generated file is a finding, and --fix rewrites it first.
// A contract may name `watch` globs: its anchor unit stands for repo-wide rules, so a scoped run also runs it when a given file matches.
// Baseline keys are file, rule, message and excerpt (no line), counted. A finding above its count exits 1, and so does an entry that fires less.
// --update-baseline records the baseline when scripts/check/baseline.json is missing; otherwise it only lowers counts and drops entries, never adds a finding. Exit 2 is a usage or contract error.
const fs = require("node:fs");
const path = require("node:path");
const { check, loadContract, format, ContractError, isUsage } = require("./engine/engine.cjs");
const { sync } = require("./engine/sync.cjs");

const BASELINE = "scripts/check/baseline.json";
const CONTRACTS = "scripts/check/contracts";
const SKILL_CONTRACTS = "plugins/*/skills/*/scripts/contract.json";

/** Paths under root matching a slash glob whose segments are literal or hold `*`. */
function expand(root, pattern) {
  let found = [root];
  for (const segment of pattern.split("/")) {
    const match = new RegExp(`^${segment.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, "[^/]*")}$`, "u");
    found = found.flatMap((dir) => {
      if (!segment.includes("*")) return fs.existsSync(path.join(dir, segment)) ? [path.join(dir, segment)] : [];
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).sort().filter((n) => match.test(n)).map((n) => path.join(dir, n)) : [];
    });
  }
  return found;
}

/** Whether a slash glob matches a path: `*` stays inside a segment, `**` crosses them. */
function globMatch(glob, file) {
  const source = glob.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace(/\*\*\//gu, "\0").replace(/\*\*/gu, "\u0001").replace(/\*/gu, "[^/]*").replace(/\0/gu, "(?:.*/)?").replace(/\u0001/gu, ".*");
  return new RegExp(`^${source}$`, "u").test(file);
}
const watches = (globs, given) => given.some((g) => (globs ?? []).some((glob) => globMatch(glob, g)));

const USAGE = "usage: run.cjs [--fix] [--update-baseline] [--root <dir>] [<file>...]";
const ENGINE_PATH = /^(scripts\/check\/engine\/|plugins\/[^/]+\/skills\/[^/]+\/scripts\/lib\/)/u;

function main(argv, { generators = require("./generators/index.cjs"), out = (text) => process.stdout.write(text) } = {}) {
  const at = argv.indexOf("--root");
  if (at >= 0 && !argv[at + 1]) throw new ContractError(USAGE);
  const root = at >= 0 ? path.resolve(argv[at + 1]) : path.resolve(__dirname, "..", "..");
  const update = argv.includes("--update-baseline");
  const fix = argv.includes("--fix");
  const given = argv.filter((a, i) => !a.startsWith("--") && (at < 0 || i !== at + 1)).map((a) => path.relative(root, path.resolve(root, a)).split(path.sep).join("/"));
  if (update && given.length) throw new ContractError(`--update-baseline takes no files. ${USAGE}`);
  const scoped = given.length > 0;
  const baselineFile = path.join(root, BASELINE);
  const recorded = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : undefined;
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");

  const findings = [];
  const checked = [];
  const files = [...(fs.existsSync(path.join(root, CONTRACTS)) ? fs.readdirSync(path.join(root, CONTRACTS)).sort().filter((n) => n.endsWith(".json")).map((n) => path.join(root, CONTRACTS, n)) : []), ...expand(root, SKILL_CONTRACTS)];
  for (const file of files) {
    const loaded = loadContract(file);
    const { targets } = loaded;
    if (!targets) continue;
    const matched = expand(root, targets);
    if (matched.length === 0) throw new ContractError(`${targets}: matches no file`);
    for (const target of matched) {
      const owned = rel(target);
      if (scoped && !watches(loaded.watch, given) && !given.some((g) => (loaded.unit === "file" ? g === owned : g.startsWith(`${owned}/`)))) continue;
      checked.push(owned);
      for (const f of check(loaded, target)) findings.push({ ...f, key: `${rel(f.path)} ${f.id} ${f.message} ${f.excerpt ?? ""}`, text: format({ ...f, path: rel(f.path) }) });
    }
  }

  const counts = {};
  for (const f of findings) counts[f.key] = (counts[f.key] ?? 0) + 1;
  const baseline = recorded ?? {};
  const sorted = (entries) => Object.fromEntries(entries.sort(([x], [y]) => x.localeCompare(y)));
  if (update && recorded === undefined) {
    fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
    fs.writeFileSync(baselineFile, `${JSON.stringify(sorted(Object.entries(counts)), null, 2)}\n`);
    out(`baseline recorded: ${findings.length} findings in ${Object.keys(counts).length} entries\n`);
    return 0;
  }
  const fresh = findings.filter((f) => counts[f.key] > (baseline[f.key] ?? 0)).map((f) => f.text);
  const inScope = (key) => !scoped || checked.some((t) => key.startsWith(`${t} `) || key.startsWith(`${t}/`));
  const gone = Object.entries(baseline)
    .filter(([key, count]) => inScope(key) && (counts[key] ?? 0) < count)
    .map(([key]) => `baseline entry no longer fires, run node scripts/check/run.cjs --update-baseline: ${key}`);
  const outdated = !scoped || given.some((g) => ENGINE_PATH.test(g));
  const stale = (outdated ? sync({ root }) : []).map((copy) => `${copy} differs from scripts/check/engine, run node scripts/check/engine/sync.cjs`);
  for (const generator of generators) {
    if (scoped && !watches(generator.watch, given)) continue;
    for (const file of generator.run({ root, write: fix })) if (!fix) stale.push(`${file} is stale, run node scripts/check/run.cjs --fix`);
  }
  if (update) {
    const kept = Object.entries(baseline).map(([key, count]) => [key, Math.min(count, counts[key] ?? 0)]).filter(([, count]) => count > 0);
    fs.writeFileSync(baselineFile, `${JSON.stringify(sorted(kept), null, 2)}\n`);
    out(`baseline shrunk to ${kept.reduce((n, [, count]) => n + count, 0)} findings in ${kept.length} entries\n`);
    const open = [...fresh, ...stale];
    if (open.length) out(`${open.join("\n")}\n`);
    return open.length ? 1 : 0;
  }
  const lines = [...fresh, ...gone, ...stale];
  if (lines.length) out(`${lines.join("\n")}\n`);
  return lines.length ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    if (!isUsage(error)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { main, expand };
