"use strict";
// Generic validator: applies a contract.json to artifacts. Knows no kind; the contract names files, ops and messages.
// Output `path:line ID message "excerpt"`. Exit 0 clean, 1 findings, 2 usage or broken contract. Node built-ins only.
const fs = require("node:fs");
const path = require("node:path");
const { readText, frontmatter, proseLines } = require("./markdown.cjs");
const { ops, OPTIONS, readSchema } = require("./ops.cjs");

const EXIT = { OK: 0, FINDINGS: 1, USAGE: 2 };
const TOP_KEYS = ["version", "kind", "unit", "targets", "marker", "watch", "rules"];
const RULE_KEYS = ["op", "in", "notIn", "why", "fix"];
const EXCERPT_LIMIT = 40;

class ContractError extends Error {}

/** A broken contract or an unreadable target is a usage error; anything else is a crash worth its stack. */
const isUsage = (error) => error instanceof ContractError || error.code === "ENOENT";

/** Glob with `*`, `**` and `{a,b}` as an anchored regex over a slash path. */
function globRegex(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      out += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") out += "[^/]*";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      out += `(?:${glob.slice(i + 1, end).split(",").map((p) => p.replace(/[.+^$()|[\]\\]/gu, "\\$&")).join("|")})`;
      i = end;
    } else out += c.replace(/[.+^$()|[\]\\?]/gu, "\\$&");
  }
  return new RegExp(`^${out}$`, "u");
}

const asList = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

/** The contract, checked against its own schema; a broken contract stops the run instead of silencing a rule. */
function loadContract(file) {
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new ContractError(`${file}: ${error.message}`);
  }
  const fail = (message) => {
    throw new ContractError(`${file}: ${message}`);
  };
  for (const key of Object.keys(contract)) if (!TOP_KEYS.includes(key)) fail(`unknown key ${key}`);
  if (contract.targets !== undefined && typeof contract.targets !== "string") fail("targets must be a glob string");
  if (contract.watch !== undefined && !(Array.isArray(contract.watch) && contract.watch.every((g) => typeof g === "string"))) fail("watch must be an array of glob strings");
  if (contract.version !== 1) fail("version must be 1");
  if (typeof contract.kind !== "string") fail("kind is required");
  if (!["folder", "file"].includes(contract.unit)) fail("unit must be folder or file");
  if (contract.unit === "folder" && !contract.marker) fail("marker is required when unit is folder");
  const prefix = `${contract.kind.toUpperCase()}-`;
  for (const [id, rule] of Object.entries(contract.rules ?? {})) {
    if (!id.startsWith(prefix) || !/-\d{2}$/u.test(id)) fail(`rule id ${id} must look like ${prefix}NN`);
    if (!(rule.op in ops)) fail(`${id}: unknown op ${rule.op}`);
    for (const key of Object.keys(rule)) if (![...RULE_KEYS, ...OPTIONS[rule.op]].includes(key)) fail(`${id}: unknown key ${key} for op ${rule.op}`);
    for (const key of rule.op === "custom" ? ["in", "why"] : ["in", "why", "fix"]) if (!rule[key]) fail(`${id}: ${key} is required`);
    if (rule.op === "max" && !["chars", "lines"].includes(rule.measure)) fail(`${id}: measure must be chars or lines`);
    if (rule.op === "json") {
      if (typeof rule.schema !== "string") fail(`${id}: schema is required`);
      try {
        readSchema(path.resolve(path.dirname(file), rule.schema));
      } catch (error) {
        fail(`${id}: ${error.message}`);
      }
    }
    rule.match = asList(rule.in).map(globRegex);
    rule.skip = asList(rule.notIn).map(globRegex);
  }
  contract.dir = path.dirname(file);
  return contract;
}

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

/** The files of one artifact, each with the slash path rules match against. */
function unitFiles(contract, target) {
  if (contract.unit === "file") return { root: path.dirname(target), files: [path.basename(target)] };
  if (!fs.existsSync(path.join(target, contract.marker))) throw new ContractError(`${path.join(target, contract.marker)}: missing, write it first`);
  return { root: target, files: walk(target).map((full) => path.relative(target, full).split(path.sep).join("/")) };
}

function excerpt(text) {
  const flat = String(text).trim().replace(/\s+/gu, " ");
  return flat.length > EXCERPT_LIMIT ? `${flat.slice(0, EXCERPT_LIMIT - 1)}…` : flat;
}

const fill = (template, values) => template.replace(/\{(\w+)\}/gu, (whole, key) => (key in values ? values[key] : whole));

/** Findings of every rule on one artifact (a folder or a file). A hit may name its own `file`, relative to the artifact's folder (a file's directory). */
function check(contract, target) {
  const { root, files } = unitFiles(contract, target);
  const findings = [];
  const views = new Map();
  const view = (file) => {
    if (!views.has(file)) {
      const abs = path.join(root, file);
      const text = readText(abs);
      const fm = frontmatter(text);
      const prose = proseLines(text).map((line, index) => (index < fm.span ? "" : line));
      views.set(file, { file, abs, root, text, lines: text.split("\n"), prose, fm, files, view, contractDir: contract.dir, customDir: path.join(contract.dir, "custom") });
    }
    return views.get(file);
  };
  for (const file of files) {
    for (const [id, rule] of Object.entries(contract.rules ?? {})) {
      if (!rule.match.some((r) => r.test(file)) || rule.skip.some((r) => r.test(file))) continue;
      for (const hit of ops[rule.op](view(file), rule)) {
        const fix = hit.fix ?? rule.fix;
        if (fix === undefined) throw new ContractError(`${id}: check ${rule.check} returned a finding without fix`);
        findings.push({ file: hit.file ?? file, line: hit.line, id, message: fill(fix, hit.values ?? {}), excerpt: hit.offending === undefined ? undefined : excerpt(hit.offending) });
      }
    }
  }
  return findings
    .map((f) => ({ ...f, path: path.join(root, f.file) }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.id.localeCompare(b.id));
}

const format = (f) => `${f.path}:${f.line} ${f.id} ${f.message}${f.excerpt === undefined ? "" : ` ${JSON.stringify(f.excerpt)}`}`;

/** CLI entry shared by every validate-<kind>.cjs. */
function run(contractFile, targets) {
  if (targets.length === 0) {
    process.stderr.write(`usage: validate-<kind>.cjs <artifact>...\n`);
    return EXIT.USAGE;
  }
  try {
    const contract = loadContract(contractFile);
    const findings = targets.flatMap((target) => check(contract, target));
    if (findings.length) process.stdout.write(`${findings.map(format).join("\n")}\n`);
    return findings.length ? EXIT.FINDINGS : EXIT.OK;
  } catch (error) {
    if (!isUsage(error)) throw error;
    process.stderr.write(`${error.message}\n`);
    return EXIT.USAGE;
  }
}

module.exports = { run, check, loadContract, format, ContractError, isUsage, globRegex };
