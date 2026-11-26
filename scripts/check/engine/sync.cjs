#!/usr/bin/env node
"use strict";
// Usage: node scripts/check/engine/sync.cjs [--check] [--root <dir>]
// Copies the engine files of this folder into the scripts/lib folder of every skill holding scripts/contract.json.
// It also generates, for each plugin holding a contract with a `scope`, hooks/artifacts.cjs (from hook.cjs), hooks/lib/contracts/lib/ (the one engine every contract there runs on) and hooks/lib/contracts/<skill>/ (the contract, its custom checks and the files its rules name), and names the files there with no source.
// It writes hooks/lib/host.cjs (the CLI's Claude adapter, cli/assets/hooks-runtime/host-claude.cjs) into each plugin whose hooks require it, and names one a plugin does not require.
// It names a plugin whose hooks.json does not call the generated artifacts.cjs; that one it cannot repair.
// With --check it writes nothing and names each copy that differs, is missing or has no source; exit 1 when any does.
const fs = require("node:fs");
const path = require("node:path");
const { readOrNull } = require("../read-or-null.cjs");

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
      if (readOrNull(copy)?.equals(source)) continue;
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
// The CLI builds every tool's adapter from this one; each plugin whose hooks require lib/host.cjs ships the Claude one.
const HOST_SOURCE = path.join(ROOT, "cli", "assets", "hooks-runtime", "host-claude.cjs");
const HOST_COPY = path.join("hooks", "lib", "host.cjs");
const HOST_REQUIRE = /require\(\s*["']\.\/(?:lib\/)?host\.cjs["']\s*\)/u;

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

const SHARED = path.join("hooks", "lib", "contracts", "lib");

/** A custom check reaches the engine at ../lib in its skill; in the hook, the one engine sits three folders up. */
const toSharedEngine = (text) => text.replaceAll('require("../lib/', 'require("../../../lib/');

/** The files a skill's contract hands its plugin's hook, keyed by their path under the plugin: the contract, its custom checks, and each template or schema a rule names. The engine is shared, see SHARED. */
function contractCopies(skill, contract) {
  const copies = new Map();
  const target = (...parts) => path.join("hooks", "lib", "contracts", path.basename(skill), ...parts);
  const add = (file, transform) => copies.set(target(path.relative(skill, file)), { file, transform });
  add(path.join(skill, "scripts", "contract.json"));
  for (const file of filesUnder(path.join(skill, "scripts", "custom"))) add(file, toSharedEngine);
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
    if (!wanted.has(plugin)) wanted.set(plugin, new Map([[path.join("hooks", "artifacts.cjs"), { file: HOOK_SOURCE }], ...ENGINE_FILES.map((name) => [path.join(SHARED, name), { file: path.join(__dirname, name) }])]));
    for (const [copy, source] of contractCopies(skill, contract)) wanted.get(plugin).set(copy, source);
  }
  const plugins = path.join(root, "plugins");
  for (const name of fs.existsSync(plugins) ? fs.readdirSync(plugins).sort() : []) {
    const plugin = path.join(plugins, name);
    const copies = wanted.get(plugin) ?? new Map();
    const scoped = copies.size > 0;
    if (scoped || requiresHost(plugin)) copies.set(HOST_COPY, { file: HOST_SOURCE });
    else if (fs.existsSync(path.join(plugin, HOST_COPY))) {
      found.push({ path: rel(path.join(plugin, HOST_COPY)), kind: "orphan" });
      if (write) fs.rmSync(path.join(plugin, HOST_COPY));
    }
    for (const [copy, { file: source, transform }] of copies) {
      const file = path.join(plugin, copy);
      const content = transform ? Buffer.from(transform(fs.readFileSync(source, "utf8"))) : fs.readFileSync(source);
      if (readOrNull(file)?.equals(content)) continue;
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
    if (scoped) for (const goal of unwired(plugin)) found.push({ path: rel(path.join(plugin, "hooks", "hooks.json")), kind: "unwired", goal });
    if (!scoped && fs.existsSync(path.join(plugin, "hooks", "artifacts.cjs"))) {
      found.push({ path: rel(path.join(plugin, "hooks", "artifacts.cjs")), kind: "orphan" });
      if (write) fs.rmSync(path.join(plugin, "hooks", "artifacts.cjs"));
    }
  }
  return found;
}

// The event each artifacts.cjs goal answers; a Stop may instead run through another hook script that requires it.
const GOAL_EVENTS = { start: "SessionStart", mark: "PostToolUse", check: "Stop" };

/** The artifacts.cjs goals the plugin's hooks.json never calls. */
function unwired(plugin) {
  const hooks = path.join(plugin, "hooks");
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  const config = read(path.join(hooks, "hooks.json"));
  const relayed = fs.existsSync(hooks) && fs.readdirSync(hooks).some((file) => file.endsWith(".cjs") && file !== "artifacts.cjs" && read(path.join(hooks, file)).includes('require("./artifacts.cjs")'));
  return Object.keys(GOAL_EVENTS).filter((goal) => !config.includes(`hooks/artifacts.cjs ${goal}`) && !(goal === "check" && relayed));
}

/** Whether a script of the plugin's hooks, other than the generated contracts, requires the host adapter. */
function requiresHost(plugin) {
  const generated = path.join(plugin, "hooks", "lib", "contracts");
  return filesUnder(path.join(plugin, "hooks")).some((file) => /\.c?js$/u.test(file) && !file.startsWith(generated + path.sep) && HOST_REQUIRE.test(fs.readFileSync(file, "utf8")));
}

/** Removes empty folders below `dir`, and `dir` itself when it ends empty. */
function pruneEmpty(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) pruneEmpty(path.join(dir, entry.name));
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/** The line that names a stale hook file. */
const describeHook = ({ path: file, kind, goal }) => {
  if (kind === "unwired") return `${file} does not call artifacts.cjs ${goal} (${GOAL_EVENTS[goal]}), copy its entry from plugins/aidd-pm/hooks/hooks.json`;
  return kind === "orphan" ? `${file} has no source in a skill contract, run node scripts/check/engine/sync.cjs` : `${file} differs from its source, run node scripts/check/engine/sync.cjs`;
};

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
    for (const copy of hooks) process.stdout.write(copy.kind === "unwired" ? `${describeHook(copy)}\n` : `${copy.kind === "orphan" ? "removed" : "synced"} ${copy.path}\n`);
    process.exitCode = hooks.some((copy) => copy.kind === "unwired") ? 1 : 0;
  }
}

module.exports = { sync, syncHooks, describeHook, contractSkills, ENGINE_FILES };
