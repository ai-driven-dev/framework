#!/usr/bin/env node
"use strict";
// Usage: node scripts/contract/run.cjs [--update-baseline] [--root <dir>]
// Checks every artifact mapped in validate.config.json against its contract, and the vendored engine copies.
// Baseline keys are file, rule, message and excerpt (no line), counted. A finding above its count exits 1, and so does an entry that fires less.
// --update-baseline records the baseline when the config has none; otherwise it only lowers counts and drops entries, never adds a finding. Exit 2 is a usage or contract error.
const fs = require("node:fs");
const path = require("node:path");
const { check, loadContract, format, ContractError, isUsage } = require("./engine.cjs");
const { sync } = require("./sync.cjs");

const CONFIG = "validate.config.json";

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
  const configFile = path.join(root, CONFIG);
  if (!fs.existsSync(configFile)) throw new ContractError(`${configFile}: missing`);
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");

  const findings = [];
  for (const { contract, targets } of config.contracts) {
    const loaded = loadContract(path.join(root, contract));
    const matched = expand(root, targets);
    if (matched.length === 0) throw new ContractError(`${targets}: matches no file`);
    for (const target of matched) {
      for (const f of check(loaded, target)) findings.push({ ...f, key: `${rel(f.path)} ${f.id} ${f.message} ${f.excerpt ?? ""}`, text: format({ ...f, path: rel(f.path) }) });
    }
  }

  const counts = {};
  for (const f of findings) counts[f.key] = (counts[f.key] ?? 0) + 1;
  const recorded = config.baseline;
  const baseline = recorded ?? {};
  const sorted = (entries) => Object.fromEntries(entries.sort(([x], [y]) => x.localeCompare(y)));
  if (update && recorded === undefined) {
    config.baseline = sorted(Object.entries(counts));
    fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    process.stdout.write(`baseline recorded: ${findings.length} findings in ${Object.keys(counts).length} entries\n`);
    return 0;
  }
  const fresh = findings.filter((f) => counts[f.key] > (baseline[f.key] ?? 0)).map((f) => f.text);
  const gone = Object.entries(baseline)
    .filter(([key, count]) => (counts[key] ?? 0) < count)
    .map(([key]) => `baseline entry no longer fires, run node scripts/contract/run.cjs --update-baseline: ${key}`);
  const stale = sync({ root }).map((copy) => `${copy} differs from scripts/contract, run node scripts/contract/sync.cjs`);
  if (update) {
    const kept = Object.entries(baseline).map(([key, count]) => [key, Math.min(count, counts[key] ?? 0)]).filter(([, count]) => count > 0);
    config.baseline = sorted(kept);
    fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
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
