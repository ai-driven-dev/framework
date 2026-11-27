#!/usr/bin/env node
"use strict";
// Usage: node write-command.cjs --project <abs dir> --tools <ids> --input <command.json> [--plan] [--force]
// Tool ids: claude,cursor,copilot,opencode,kilo.
// Renders one canonical command as each host's native file.
// Exit 0 ok, 1 refusal, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--plan", "--force"];
const VALUES = ["--project", "--tools", "--input"];
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LINE_BREAK = /[\r\n]/;
const CRLF = /\r\n/g;
const BODY = "body";
const BOOLEAN_KEYS = ["disable-model-invocation"];
// A YAML plain scalar that reads back as the same string; anything else is double-quoted.
const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9 ._/,'()-]*$/;
const YAML_KEYWORD = /^(true|false|null|yes|no|on|off)$/i;
const MISSING = ["ENOENT", "ENOTDIR"];
const NATIVE_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const IDENTITY_KEYS = ["name", "description", BODY, "nativeOptions", "template"];

// Each host keeps the keys it documents, in this order. Cursor documents no frontmatter for a command.
// Claude's own `agent` names a forked subagent, not the primary agent the other hosts mean.
const HOSTS = {
  claude: {
    path: (name) => `.claude/commands/${name}.md`,
    keys: ["description", "argument-hint", "model", "allowed-tools", "disable-model-invocation"],
  },
  cursor: { path: (name) => `.cursor/commands/${name}.md`, keys: [] },
  copilot: { path: (name) => `.github/prompts/${name}.prompt.md`, keys: ["description", "argument-hint", "agent", "model"] },
  opencode: { path: (name) => `.opencode/commands/${name}.md`, keys: ["description", "agent", "model"] },
  kilo: { path: (name) => `.kilo/commands/${name}.md`, keys: ["description", "agent", "model"] },
};
const TOOLS = Object.keys(HOSTS);

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const known = FLAGS.includes(name) || VALUES.includes(name);
    if (!known || name in options) throw new UsageError(`Bad option: ${name}`);
    if (FLAGS.includes(name)) {
      options[name] = true;
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new UsageError(`Missing value: ${name}`);
    options[name] = value;
  }
  if (VALUES.some((name) => !options[name])) throw new UsageError("--project, --tools and --input are required.");
  return options;
}

function realProject(value) {
  const isReal = path.isAbsolute(value) && fs.existsSync(value) && fs.realpathSync(value) === path.resolve(value);
  if (!isReal) refuse("--project must be an absolute real directory.");
  return path.resolve(value);
}

function selectedTools(value) {
  const tools = value.split(",");
  if (tools.some((tool) => !TOOLS.includes(tool))) {
    refuse(`Unknown tool; expected ${TOOLS.join(",")}. A host without project commands takes a skill instead.`);
  }
  return TOOLS.filter((tool) => tools.includes(tool));
}

function readCommand(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return refuse("Input must be a readable JSON file.");
  }
}

const isSingleLine = (value) => typeof value === "string" && !LINE_BREAK.test(value);
const isFilled = (value) => typeof value === "string" && value.trim() !== "";
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isBoolean = (value) => typeof value === "boolean";
const nativeChecks = {
  claude: { context: (value) => value === "fork" },
  copilot: { tools: (value) => Array.isArray(value) && value.every(isSingleLine) },
  kilo: { variant: (value) => isSingleLine(value) && isFilled(value), subtask: isBoolean },
  opencode: { subagent: isBoolean, subtask: isBoolean },
};

function serializable(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(serializable);
  if (isObject(value)) return Object.entries(value).every(([key, item]) => key !== "__proto__" && serializable(item));
  return true;
}

function validateNativeOptions(command, tools) {
  if (command.nativeOptions === undefined) return;
  if (!isObject(command.nativeOptions)) refuse("nativeOptions must be an object keyed by selected target.");
  for (const [tool, options] of Object.entries(command.nativeOptions)) {
    if (!tools.includes(tool)) refuse(`${tool}: native options require a selected target.`);
    if (!isObject(options)) refuse(`${tool}: native options must be an object.`);
    const { keys } = HOSTS[tool];
    if (!keys.length && Object.keys(options).length) refuse(`${tool}: commands have no native option surface.`);
    for (const [key, value] of Object.entries(options)) {
      if (!NATIVE_KEY.test(key) || key === "constructor" || key === "prototype") refuse(`${tool}: invalid native field ${JSON.stringify(key)}.`);
      if (IDENTITY_KEYS.includes(key) || keys.includes(key)) refuse(`${tool}: native field ${key} is managed by the writer.`);
      const check = Object.hasOwn(nativeChecks[tool] ?? {}, key) ? nativeChecks[tool][key] : undefined;
      if (!serializable(value) || (check && !check(value))) refuse(`${tool}: native field ${key} has an unsupported value.`);
    }
  }
}

function valueAccepted(key, value) {
  if (key === BODY) return true;
  if (BOOLEAN_KEYS.includes(key)) return typeof value === "boolean";
  return isSingleLine(value);
}

function validate(command, tools) {
  if (!command || typeof command !== "object" || Array.isArray(command)) refuse("Input must be a JSON object.");
  if (typeof command.name !== "string" || !KEBAB_CASE.test(command.name)) refuse("Name must be kebab-case.");
  if (!isFilled(command.description) || !isSingleLine(command.description)) refuse("Description must be a non-empty single line.");
  if (!isFilled(command.body)) refuse("Body must be non-empty.");
  for (const [key, value] of Object.entries(command)) {
    if (key !== "nativeOptions" && !valueAccepted(key, value)) refuse(`Field ${key} has an unsupported value.`);
  }
  validateNativeOptions(command, tools);
}

function yamlScalar(value) {
  if (typeof value === "boolean") return String(value);
  const plain = PLAIN_SCALAR.test(value) && !value.endsWith(" ") && !YAML_KEYWORD.test(value);
  return plain ? value : JSON.stringify(value);
}

function nativeValue(value) {
  return JSON.stringify(value).replace(/[\u007f\u0085\u2028\u2029]/gu, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function render(tool, command) {
  const body = command.body.endsWith("\n") ? command.body : `${command.body}\n`;
  const lines = HOSTS[tool].keys.filter((key) => command[key] !== undefined).map((key) => `${key}: ${yamlScalar(command[key])}`);
  for (const [key, value] of Object.entries(command.nativeOptions?.[tool] ?? {})) lines.push(`${key}: ${nativeValue(value)}`);
  return lines.length ? `---\n${lines.join("\n")}\n---\n\n${body}` : body;
}

function droppedFields(tool, command) {
  const kept = ["name", BODY, "nativeOptions", ...HOSTS[tool].keys];
  return Object.keys(command).filter((key) => !kept.includes(key)).map((field) => ({ tool, field }));
}

// No symlink from the project to a target, the target included: a link would write outside it.
function assertNoSymlink(project, relative) {
  let current = project;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (MISSING.includes(error.code)) return;
      throw error;
    }
    if (stat.isSymbolicLink()) refuse(`Symlink on the way to ${relative}.`);
  }
}

function readOrNull(file) {
  try {
    // A Windows checkout may turn every line ending into CRLF; the writer reads and writes LF.
    return fs.readFileSync(file, "utf8").replace(CRLF, "\n");
  } catch (error) {
    if (MISSING.includes(error.code)) return null;
    throw error;
  }
}

function operationOf(current, content) {
  if (current === null) return "create";
  return current === content ? "unchanged" : "update";
}

function planFiles(project, tools, command) {
  return tools.map((tool) => {
    const relative = HOSTS[tool].path(command.name);
    assertNoSymlink(project, relative);
    const content = render(tool, command);
    const operation = operationOf(readOrNull(path.join(project, relative)), content);
    return { tool, path: relative, content, operation };
  });
}

function applyPlan(project, plan, force) {
  const changed = plan.filter((file) => file.operation !== "unchanged");
  const overwritten = changed.filter((file) => file.operation === "update").map((file) => file.path);
  if (overwritten.length && !force) refuse(`Would overwrite ${overwritten.join(", ")}; rerun with --force once approved.`);
  // Every directory first, so a path that cannot exist fails before any file is written.
  for (const file of changed) fs.mkdirSync(path.dirname(path.join(project, file.path)), { recursive: true });
  for (const file of changed) fs.writeFileSync(path.join(project, file.path), file.content);
}

function main(argv) {
  const options = parseArgs(argv);
  const project = realProject(options["--project"]);
  const tools = selectedTools(options["--tools"]);
  const command = readCommand(options["--input"]);
  validate(command, tools);
  const plan = planFiles(project, tools, command);
  if (!options["--plan"]) applyPlan(project, plan, options["--force"]);
  return {
    files: plan.map((file) => ({ path: file.path, operation: file.operation })),
    dropped: plan.flatMap((file) => droppedFields(file.tool, command)),
  };
}

function failureOf(error) {
  if (error instanceof UsageError) return { code: EXIT.USAGE, error: { code: "USAGE", message: error.message } };
  if (error instanceof Refusal) return { code: EXIT.REFUSED, error: { code: "REFUSED", message: error.message } };
  if (error.code) return { code: EXIT.FILESYSTEM, error: { code: error.code, message: error.message } };
  throw error;
}

function run() {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
    process.exitCode = EXIT.OK;
  } catch (thrown) {
    const failure = failureOf(thrown);
    process.stdout.write(`${JSON.stringify({ error: failure.error }, null, 2)}\n`);
    process.exitCode = failure.code;
  }
}

if (require.main === module) run();

module.exports = { TOOLS };
