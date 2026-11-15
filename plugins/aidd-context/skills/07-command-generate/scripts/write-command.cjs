#!/usr/bin/env node
"use strict";
// Usage: node write-command.cjs --project <abs dir> --tools <ids> --input <command.json> [--plan | --check] [--force]
// Tool ids: claude,cursor,copilot,opencode,kilo.
// Renders one canonical command as each host's native file.
// Exit 0 ok, 1 refusal or drift, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--plan", "--check", "--force"];
const VALUES = ["--project", "--tools", "--input"];

// Each host keeps the keys it documents, in this order. Cursor documents no frontmatter for a command.
// Claude's own `agent` names a forked subagent, not the primary agent the other hosts mean.
const HOSTS = {
  claude: { path: (n) => `.claude/commands/${n}.md`, keys: ["description", "argument-hint", "model", "allowed-tools", "disable-model-invocation"] },
  cursor: { path: (n) => `.cursor/commands/${n}.md`, keys: [] },
  copilot: { path: (n) => `.github/prompts/${n}.prompt.md`, keys: ["description", "argument-hint", "agent", "model"] },
  opencode: { path: (n) => `.opencode/commands/${n}.md`, keys: ["description", "agent", "model"] },
  kilo: { path: (n) => `.kilo/commands/${n}.md`, keys: ["description", "agent", "model"] },
};
const TOOLS = Object.keys(HOSTS);

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!(FLAGS.includes(name) || VALUES.includes(name)) || name in options) throw new UsageError(`Bad option: ${name}`);
    if (FLAGS.includes(name)) { options[name] = true; continue; }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new UsageError(`Missing value: ${name}`);
    options[name] = value;
  }
  if (VALUES.some((name) => !options[name])) throw new UsageError("--project, --tools and --input are required.");
  if (options["--plan"] && options["--check"]) throw new UsageError("Choose --plan or --check, not both.");
  return options;
}

function validate(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) refuse("Input must be a JSON object.");
  if (typeof command.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(command.name)) refuse("Name must be kebab-case.");
  if (typeof command.description !== "string" || !command.description.trim() || /[\r\n]/.test(command.description)) refuse("Description must be a non-empty single line.");
  if (typeof command.body !== "string" || !command.body.trim()) refuse("Body must be non-empty.");
  for (const [key, value] of Object.entries(command)) {
    const ok = key === "disable-model-invocation" ? typeof value === "boolean" : typeof value === "string" && !/[\r\n]/.test(value) || key === "body";
    if (!ok) refuse(`Field ${key} has an unsupported value.`);
  }
}

// Plain when YAML reads it back unchanged, double-quoted otherwise.
const yamlScalar = (value) => (typeof value === "boolean" || /^[A-Za-z0-9][A-Za-z0-9 ._/,'()-]*$/.test(value) && !/ $|^(true|false|null|yes|no|on|off)$/i.test(value) ? String(value) : JSON.stringify(value));

function render(host, command) {
  const body = command.body.endsWith("\n") ? command.body : `${command.body}\n`;
  const yaml = host.keys.filter((key) => command[key] !== undefined).map((key) => `${key}: ${yamlScalar(command[key])}`);
  return yaml.length ? `---\n${yaml.join("\n")}\n---\n\n${body}` : body;
}

const dropped = (tool, command) => Object.keys(command).filter((key) => !["name", "body", ...HOSTS[tool].keys].includes(key)).map((field) => ({ tool, field }));

// No symlink from the project to a target, the target included: a link would write outside it.
function assertNoSymlink(project, relative) {
  let current = project;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) refuse(`Symlink on the way to ${relative}.`); } catch (error) { if (error instanceof Refusal) throw error; return; }
  }
}

function readOrNull(file) {
  try { return fs.readFileSync(file, "utf8"); } catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error; }
}

// A sibling temporary file renamed over the target never leaves the target half written.
function writeAtomically(file, text) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, text);
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function main(argv) {
  const options = parseArgs(argv);
  const project = path.resolve(options["--project"]);
  if (!path.isAbsolute(options["--project"]) || !fs.existsSync(project) || fs.realpathSync(project) !== project) refuse("--project must be an absolute real directory.");
  const tools = options["--tools"].split(",");
  if (tools.some((tool) => !TOOLS.includes(tool))) refuse(`Unknown tool; expected ${TOOLS.join(",")}. A host without project commands takes a skill instead.`);
  let command;
  try { command = JSON.parse(fs.readFileSync(options["--input"], "utf8")); } catch { refuse("Input must be a readable JSON file."); }
  validate(command);
  const plan = TOOLS.filter((tool) => tools.includes(tool)).map((tool) => {
    const relative = HOSTS[tool].path(command.name);
    assertNoSymlink(project, relative);
    const content = render(HOSTS[tool], command);
    const current = readOrNull(path.join(project, relative));
    return { tool, path: relative, content, operation: current === null ? "create" : current === content ? "unchanged" : "update" };
  });
  if (options["--check"]) {
    const drift = plan.filter((file) => file.operation !== "unchanged").map((file) => file.path);
    return { code: drift.length ? EXIT.REFUSED : EXIT.OK, result: { drift } };
  }
  const result = { files: plan.map(({ path: p, operation }) => ({ path: p, operation })), dropped: plan.flatMap((file) => dropped(file.tool, command)) };
  if (!options["--plan"]) {
    const changed = plan.filter((f) => f.operation !== "unchanged");
    const overwritten = changed.filter((f) => f.operation === "update").map((f) => f.path);
    if (overwritten.length && !options["--force"]) refuse(`Would overwrite ${overwritten.join(", ")}; rerun with --force once approved.`);
    // Every directory first, so a path that cannot exist fails before any file is written.
    for (const file of changed) fs.mkdirSync(path.dirname(path.join(project, file.path)), { recursive: true });
    for (const file of changed) writeAtomically(path.join(project, file.path), file.content);
  }
  return { code: EXIT.OK, result };
}

let outcome;
try {
  outcome = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) outcome = { code: EXIT.USAGE, result: { error: { code: "USAGE", message: error.message } } };
  else if (error instanceof Refusal) outcome = { code: EXIT.REFUSED, result: { error: { code: "REFUSED", message: error.message } } };
  else if (error.code) outcome = { code: EXIT.FILESYSTEM, result: { error: { code: error.code, message: error.message } } };
  else outcome = { code: EXIT.REFUSED, result: { error: { code: "UNEXPECTED", message: error.message } } };
}
process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
process.exitCode = outcome.code;
