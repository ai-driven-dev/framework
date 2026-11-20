#!/usr/bin/env node
"use strict";
// Usage: node scripts/contract/run.cjs [--update-baseline] [--root <dir>]
// Checks every artifact mapped in validate.config.json against its contract, and the vendored engine copies.
// Findings already counted in the config's baseline pass; any other finding exits 1. Exit 2 is a usage or contract error.
const fs = require("node:fs");
const path = require("node:path");
const { check, loadContract, format } = require("./engine.cjs");
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
  const root = at >= 0 ? path.resolve(argv[at + 1]) : path.resolve(__dirname, "..", "..");
  const update = argv.includes("--update-baseline");
  const configFile = path.join(root, CONFIG);
  if (!fs.existsSync(configFile)) throw new Error(`${configFile}: missing`);
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");

  const findings = [];
  for (const { contract, targets } of config.contracts) {
    const loaded = loadContract(path.join(root, contract));
    for (const target of expand(root, targets)) {
      for (const f of check(loaded, target)) findings.push({ ...f, key: `${rel(f.path)} ${f.id}`, text: format({ ...f, path: rel(f.path) }) });
    }
  }

  const counts = {};
  for (const f of findings) counts[f.key] = (counts[f.key] ?? 0) + 1;
  if (update) {
    config.baseline = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    process.stdout.write(`baseline: ${findings.length} findings in ${Object.keys(counts).length} entries\n`);
    return 0;
  }

  const baseline = config.baseline ?? {};
  const fresh = findings.filter((f) => counts[f.key] > (baseline[f.key] ?? 0)).map((f) => f.text);
  const stale = sync({ root }).map((copy) => `${copy} differs from scripts/contract, run node scripts/contract/sync.cjs`);
  const lines = [...fresh, ...stale];
  if (lines.length) process.stdout.write(`${lines.join("\n")}\n`);
  return lines.length ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { main, expand };
