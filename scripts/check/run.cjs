#!/usr/bin/env node
"use strict";
// Usage: node scripts/check/run.cjs [--update-baseline] [--root <dir>]
// Checks every artifact each contract names in its `targets` (scripts/check/contracts/*.json and plugins/*/skills/*/scripts/contract.json), and the vendored engine copies.
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

function main(argv) {
  const at = argv.indexOf("--root");
  if (at >= 0 && !argv[at + 1]) throw new ContractError("usage: run.cjs [--update-baseline] [--root <dir>]");
  const root = at >= 0 ? path.resolve(argv[at + 1]) : path.resolve(__dirname, "..", "..");
  const update = argv.includes("--update-baseline");
  const baselineFile = path.join(root, BASELINE);
  const recorded = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : undefined;
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");

  const findings = [];
  const files = [...(fs.existsSync(path.join(root, CONTRACTS)) ? fs.readdirSync(path.join(root, CONTRACTS)).sort().filter((n) => n.endsWith(".json")).map((n) => path.join(root, CONTRACTS, n)) : []), ...expand(root, SKILL_CONTRACTS)];
  for (const file of files) {
    const loaded = loadContract(file);
    const { targets } = loaded;
    if (!targets) continue;
    const matched = expand(root, targets);
    if (matched.length === 0) throw new ContractError(`${targets}: matches no file`);
    for (const target of matched) {
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
    process.stdout.write(`baseline recorded: ${findings.length} findings in ${Object.keys(counts).length} entries\n`);
    return 0;
  }
  const fresh = findings.filter((f) => counts[f.key] > (baseline[f.key] ?? 0)).map((f) => f.text);
  const gone = Object.entries(baseline)
    .filter(([key, count]) => (counts[key] ?? 0) < count)
    .map(([key]) => `baseline entry no longer fires, run node scripts/check/run.cjs --update-baseline: ${key}`);
  const stale = sync({ root }).map((copy) => `${copy} differs from scripts/check/engine, run node scripts/check/engine/sync.cjs`);
  if (update) {
    const kept = Object.entries(baseline).map(([key, count]) => [key, Math.min(count, counts[key] ?? 0)]).filter(([, count]) => count > 0);
    fs.writeFileSync(baselineFile, `${JSON.stringify(sorted(kept), null, 2)}\n`);
    process.stdout.write(`baseline shrunk to ${kept.reduce((n, [, count]) => n + count, 0)} findings in ${kept.length} entries\n`);
    const open = [...fresh, ...stale];
    if (open.length) process.stdout.write(`${open.join("\n")}\n`);
    return open.length ? 1 : 0;
  }
  const lines = [...fresh, ...gone, ...stale];
  if (lines.length) process.stdout.write(`${lines.join("\n")}\n`);
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
