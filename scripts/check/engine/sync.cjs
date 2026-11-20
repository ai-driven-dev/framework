#!/usr/bin/env node
"use strict";
// Usage: node scripts/check/engine/sync.cjs [--check] [--root <dir>]
// Copies the engine files of this folder into the scripts/lib folder of every skill holding scripts/contract.json.
// It also generates, for each plugin holding a contract with a `scope`, hooks/artifacts.cjs (from hook.cjs) and hooks/lib/contracts/<skill>/ (the contract, its lib, its custom checks and the files its rules name), and names the files there with no source.
// With --check it writes nothing and names each copy that differs, is missing or has no source; exit 1 when any does.
const fs = require("node:fs");
const path = require("node:path");

const ENGINE_FILES = ["engine.cjs", "ops.cjs", "markdown.cjs"];
const ROOT = path.resolve(__dirname, "..", "..", "..");

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
      stale.push(path.relative(root, copy).split(path.sep).join("/"));
      if (write) {
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.writeFileSync(copy, source);
      }
    }
  }
  return stale;
}

const HOOK_SOURCE = path.join(__dirname, "hook.cjs");

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const filesUnder = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))
    : [];

/** The files a skill's contract hands its plugin's hook, keyed by their path under the plugin: the contract, its lib and custom checks, and each template or schema a rule names. */
function contractCopies(skill, contract) {
  const copies = new Map();
  const target = (...parts) => path.join("hooks", "lib", "contracts", path.basename(skill), ...parts);
  const add = (file) => copies.set(target(path.relative(skill, file)), file);
  add(path.join(skill, "scripts", "contract.json"));
  for (const dir of ["lib", "custom"]) for (const file of filesUnder(path.join(skill, "scripts", dir))) add(file);
  for (const rule of Object.values(contract.rules ?? {})) {
    for (const name of [rule.template, rule.schema]) {
      if (typeof name !== "string") continue;
      const file = path.resolve(skill, "scripts", name);
      if (!path.relative(skill, file).startsWith("..") && fs.existsSync(file)) add(file);
    }
  }
  return copies;
}

/** The hook files of every plugin with a scoped contract that differ from their source, are missing, or have none: `{ path, kind }`, kind `stale` or `orphan`. With `write`, regenerates them and deletes the orphans. */
function syncHooks({ root = ROOT, write = false } = {}) {
  const found = [];
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");
  const wanted = new Map();
  for (const skill of contractSkills(root)) {
    const contract = readJson(path.join(skill, "scripts", "contract.json"));
    if (!Array.isArray(contract?.scope)) continue;
    const plugin = path.resolve(skill, "..", "..");
    if (!wanted.has(plugin)) wanted.set(plugin, new Map([[path.join("hooks", "artifacts.cjs"), HOOK_SOURCE]]));
    for (const [copy, source] of contractCopies(skill, contract)) wanted.get(plugin).set(copy, source);
  }
  const plugins = path.join(root, "plugins");
  for (const name of fs.existsSync(plugins) ? fs.readdirSync(plugins).sort() : []) {
    const plugin = path.join(plugins, name);
    const copies = wanted.get(plugin) ?? new Map();
    for (const [copy, source] of copies) {
      const file = path.join(plugin, copy);
      const content = fs.readFileSync(source);
      if (fs.existsSync(file) && fs.readFileSync(file).equals(content)) continue;
      found.push({ path: rel(file), kind: "stale" });
      if (write) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    }
    const generated = path.join(plugin, "hooks", "lib", "contracts");
    for (const file of filesUnder(generated)) {
      if (copies.has(path.relative(plugin, file))) continue;
      found.push({ path: rel(file), kind: "orphan" });
      if (write) fs.rmSync(file);
    }
    if (write && fs.existsSync(generated)) pruneEmpty(generated);
    if (!copies.size && fs.existsSync(path.join(plugin, "hooks", "artifacts.cjs"))) {
      found.push({ path: rel(path.join(plugin, "hooks", "artifacts.cjs")), kind: "orphan" });
      if (write) fs.rmSync(path.join(plugin, "hooks", "artifacts.cjs"));
    }
  }
  return found;
}

/** Removes empty folders below `dir`, and `dir` itself when it ends empty. */
function pruneEmpty(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) pruneEmpty(path.join(dir, entry.name));
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/** The line that names a stale hook file. */
const describeHook = ({ path: file, kind }) => (kind === "orphan" ? `${file} has no source in a skill contract, run node scripts/check/engine/sync.cjs` : `${file} differs from its source, run node scripts/check/engine/sync.cjs`);

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const at = args.indexOf("--root");
  if (at >= 0 && !args[at + 1]) {
    process.stderr.write("usage: sync.cjs [--check] [--root <dir>]\n");
    process.exit(2);
  }
  const root = at >= 0 ? path.resolve(args[at + 1]) : ROOT;
  const stale = sync({ root, write: !check });
  const hooks = syncHooks({ root, write: !check });
  if (check) {
    for (const copy of stale) process.stdout.write(`${copy} differs from scripts/check/engine, run node scripts/check/engine/sync.cjs\n`);
    for (const copy of hooks) process.stdout.write(`${describeHook(copy)}\n`);
    process.exitCode = stale.length || hooks.length ? 1 : 0;
  } else {
    for (const copy of stale) process.stdout.write(`synced ${copy}\n`);
    for (const copy of hooks) process.stdout.write(`${copy.kind === "orphan" ? "removed" : "synced"} ${copy.path}\n`);
  }
}

module.exports = { sync, syncHooks, describeHook, contractSkills, ENGINE_FILES };
