#!/usr/bin/env node
"use strict";
// Usage: node scripts/contract/sync.cjs [--check] [--root <dir>]
// Copies the engine files of this folder into the scripts/lib folder of every skill holding scripts/contract.json.
// With --check it writes nothing and names each copy that differs or is missing; exit 1 when any does.
const fs = require("node:fs");
const path = require("node:path");

const ENGINE_FILES = ["engine.cjs", "ops.cjs", "markdown.cjs"];
const ROOT = path.resolve(__dirname, "..", "..");

/** Every plugin skill folder that holds a contract. */
function contractSkills(root = ROOT) {
  const plugins = path.join(root, "plugins");
  if (!fs.existsSync(plugins)) return [];
  return fs
    .readdirSync(plugins)
    .sort()
    .flatMap((plugin) => {
      const skills = path.join(plugins, plugin, "skills");
      return fs.existsSync(skills) ? fs.readdirSync(skills).sort().map((skill) => path.join(skills, skill)) : [];
    })
    .filter((skill) => fs.existsSync(path.join(skill, "scripts", "contract.json")));
}

/** Copies not byte-identical to their source; with `write`, rewrites them. */
function sync({ root = ROOT, write = false } = {}) {
  const stale = [];
  for (const skill of contractSkills(root)) {
    for (const name of ENGINE_FILES) {
      const source = fs.readFileSync(path.join(__dirname, name));
      const copy = path.join(skill, "scripts", "lib", name);
      if (fs.existsSync(copy) && fs.readFileSync(copy).equals(source)) continue;
      stale.push(path.relative(root, copy));
      if (write) {
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.writeFileSync(copy, source);
      }
    }
  }
  return stale;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const at = args.indexOf("--root");
  const stale = sync({ root: at >= 0 ? path.resolve(args[at + 1]) : ROOT, write: !check });
  if (check) {
    for (const copy of stale) process.stdout.write(`${copy} differs from scripts/contract, run node scripts/contract/sync.cjs\n`);
    process.exitCode = stale.length ? 1 : 0;
  } else {
    for (const copy of stale) process.stdout.write(`synced ${copy}\n`);
  }
}

module.exports = { sync, contractSkills, ENGINE_FILES };
