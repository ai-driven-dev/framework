#!/usr/bin/env node
"use strict";
// Usage: node write-decision.cjs --project <abs dir> --input <decision.json> [--supersedes <record>] [--plan]
// Writes one decision record from ../assets/adr-template.md, and links the record it replaces.
// Exit 0 ok, 1 refusal, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--plan"];
const VALUES = ["--project", "--input", "--supersedes"];
const SECTIONS = ["context", "decision", "alternatives", "consequences"];
const DEFAULT_DIR = "aidd_docs/memory/internal/decisions";
const KNOWN_DIRS = [DEFAULT_DIR, "docs/adr", "docs/adrs", "docs/decisions", "docs/architecture/decisions", "adr"];
const TEMPLATE = path.join(__dirname, "../assets/adr-template.md");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_LINE = /^- Status:.*$/m;
const CRLF = /\r\n/g;
const MISSING = ["ENOENT", "ENOTDIR"];

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };
const isFilled = (value) => typeof value === "string" && value.trim() !== "";

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!(FLAGS.includes(name) || VALUES.includes(name)) || name in options) throw new UsageError(`Bad option: ${name}`);
    if (FLAGS.includes(name)) {
      options[name] = true;
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new UsageError(`Missing value: ${name}`);
    options[name] = value;
  }
  if (!options["--project"] || !options["--input"]) throw new UsageError("--project and --input are required.");
  const project = options["--project"];
  if (!path.isAbsolute(project) || !fs.existsSync(project) || fs.realpathSync(project) !== path.resolve(project)) {
    throw new UsageError("--project must be an absolute real directory.");
  }
  return options;
}

function readDecision(file) {
  let decision;
  try {
    decision = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return refuse("Input must be a readable JSON file.");
  }
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) refuse("Input must be a JSON object.");
  if (!isFilled(decision.title) || /[\r\n]/.test(decision.title)) refuse("title must be a non-empty single line.");
  if (!DATE.test(decision.date ?? "")) refuse("date must read YYYY-MM-DD.");
  for (const key of SECTIONS) if (!isFilled(decision[key])) refuse(`${key} must be non-empty.`);
  return decision;
}

const slugOf = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function readOrNull(file) {
  try {
    return fs.readFileSync(file, "utf8").replace(CRLF, "\n");
  } catch (error) {
    if (MISSING.includes(error.code)) return null;
    throw error;
  }
}

function hasRecords(dir) {
  try {
    return fs.readdirSync(dir).some((name) => name.endsWith(".md"));
  } catch (error) {
    if (MISSING.includes(error.code)) return false;
    throw error;
  }
}

const decisionDir = (project) => KNOWN_DIRS.find((dir) => hasRecords(path.join(project, dir))) ?? DEFAULT_DIR;
const posixRelative = (from, to) => path.relative(from, to).split(path.sep).join("/");

function insideProject(project, relative) {
  const full = path.resolve(project, relative);
  if (path.isAbsolute(relative) || !full.startsWith(project + path.sep)) refuse("--supersedes must name a file inside the project.");
  return full;
}

function render(decision, supersedes) {
  const template = fs.readFileSync(TEMPLATE, "utf8").replace(CRLF, "\n");
  const lines = template.split("\n").filter((line) => !line.startsWith("> Fill") && (supersedes || !line.startsWith("- Supersedes:")));
  const values = { ...decision, supersedes };
  const text = lines.join("\n").replace(/<(title|date|supersedes|context|decision|alternatives|consequences)>/g, (_, key) => String(values[key]).trim());
  return `${text.trimEnd()}\n`;
}

function relink(old, newName) {
  if (!STATUS_LINE.test(old)) refuse("The replaced record has no Status line.");
  return old.replace(STATUS_LINE, `- Status: Superseded\n- Superseded by: ${newName}`);
}

function main(argv) {
  const options = parseArgs(argv);
  const project = path.resolve(options["--project"]);
  const decision = readDecision(options["--input"]);
  const slug = slugOf(decision.title);
  if (!slug) refuse("title must hold a letter or a digit.");
  const dir = decisionDir(project);
  const created = `${dir}/${slug}.md`;
  const createdFull = path.join(project, created);
  if (options["--plan"] && fs.existsSync(createdFull)) refuse(`${created} already exists.`);
  const operations = [{ path: created, op: "create" }];
  let supersedes = null;
  let oldFull = null;
  if (options["--supersedes"]) {
    oldFull = insideProject(project, options["--supersedes"]);
    const old = readOrNull(oldFull);
    if (old === null) refuse(`${options["--supersedes"]} does not exist.`);
    supersedes = { text: relink(old, posixRelative(path.dirname(oldFull), createdFull)), link: posixRelative(path.dirname(createdFull), oldFull) };
    operations.push({ path: posixRelative(project, oldFull), op: "update" });
  }
  if (!options["--plan"]) {
    fs.mkdirSync(path.dirname(createdFull), { recursive: true });
    fs.writeFileSync(createdFull, render(decision, supersedes?.link), { flag: "wx" });
    if (supersedes) fs.writeFileSync(oldFull, supersedes.text);
  }
  return { operations };
}

function failureOf(error) {
  if (error instanceof UsageError) return { code: EXIT.USAGE, error: { code: "USAGE", message: error.message } };
  if (error instanceof Refusal) return { code: EXIT.REFUSED, error: { code: "REFUSED", message: error.message } };
  if (error.code === "EEXIST") return { code: EXIT.REFUSED, error: { code: "REFUSED", message: "The record already exists." } };
  if (error.code) return { code: EXIT.FILESYSTEM, error: { code: error.code, message: error.message } };
  throw error;
}

try {
  process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
  process.exitCode = EXIT.OK;
} catch (thrown) {
  const failure = failureOf(thrown);
  process.stdout.write(`${JSON.stringify({ error: failure.error }, null, 2)}\n`);
  process.exitCode = failure.code;
}
