#!/usr/bin/env node
"use strict";
// Usage: node write-agent.cjs --project <abs dir> --tools <ids> --input <agent.json> [--plan | --check]
// Tool ids: claude,cursor,copilot,antigravity,codex,opencode,kilo.
// Renders one canonical agent as each host's native file, with the key mapping of the aidd CLI.
// Exit 0 ok, 1 refusal or drift, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--plan", "--check"];
const VALUES = ["--project", "--tools", "--input"];

// Each host keeps its own keys only. `effort` becomes the host's own spelling of it.
// Claude also keeps the keys only it reads, which the CLI drops, so an existing agent survives a rewrite.
// A host that spells effort inside the model value loses an effort given without a model.
const withEffort = (open, close = "") => (a) => (a.model && a.effort ? `${a.model}${open}${a.effort}${close}` : a.model);
const HOSTS = {
  claude: { path: (n) => `.claude/agents/${n}.md`, fields: (a) => ({ name: a.name, description: a.description, model: a.model, effort: a.effort, tools: a.tools, color: a.color, permissionMode: a.permissionMode, disallowedTools: a.disallowedTools }), uses: ["model", "effort", "tools", "color", "permissionMode", "disallowedTools"] },
  cursor: { path: (n) => `.cursor/agents/${n}.md`, fields: (a) => ({ name: a.name, description: a.description, model: withEffort("[effort=", "]")(a) }), uses: ["model", "effort"], effortNeedsModel: true },
  copilot: { path: (n) => `.github/agents/${n}.agent.md`, fields: (a) => ({ name: a.name, description: a.description, model: a.model, reasoningEffort: a.effort, "include-custom-instructions": a["include-custom-instructions"] ?? true }), uses: ["model", "effort", "include-custom-instructions"] },
  antigravity: { path: (n) => `.agents/agents/${n}/agent.md`, fields: (a) => ({ name: a.name, description: a.description, model: "inherit", tools: toolList(a.tools) }), uses: ["tools"] },
  codex: { path: (n) => `.codex/agents/${n}.toml`, fields: (a) => ({ name: a.name, description: a.description, model: a.model, model_reasoning_effort: a.effort }), uses: ["model", "effort"], toml: true },
  opencode: { path: (n) => `.opencode/agents/${n}.md`, fields: (a) => ({ description: a.description, model: withEffort("#")(a), mode: "subagent" }), uses: ["model", "effort"], effortNeedsModel: true },
  kilo: { path: (n) => `.kilo/agents/${n}.md`, fields: (a) => ({ description: a.description, model: a.model, variant: a.effort, mode: "subagent" }), uses: ["model", "effort"] },
};
const TOOLS = Object.keys(HOSTS);

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };

function toolList(tools) {
  if (tools === undefined) return undefined;
  const list = Array.isArray(tools) ? tools : tools.split(",").map((tool) => tool.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

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

function validate(agent) {
  if (!agent || typeof agent !== "object" || Array.isArray(agent)) refuse("Input must be a JSON object.");
  if (typeof agent.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agent.name)) refuse("Name must be kebab-case.");
  if (typeof agent.description !== "string" || !agent.description.trim() || /[\r\n]/.test(agent.description)) refuse("Description must be a non-empty single line.");
  if (typeof agent.body !== "string" || !agent.body.trim()) refuse("Body must be non-empty.");
  if (agent.body.includes("'''")) refuse("Body must not contain ''' (the Codex delimiter).");
  for (const [key, value] of Object.entries(agent)) {
    const ok = typeof value === "string" || (key === "tools" && Array.isArray(value) && value.every((v) => typeof v === "string")) || (key === "include-custom-instructions" && typeof value === "boolean");
    if (!ok) refuse(`Field ${key} has an unsupported value.`);
  }
}

// Plain when YAML reads it back unchanged, double-quoted otherwise: Cursor keeps single quotes as text.
const yamlScalar = (value) => (typeof value === "boolean" || /^[A-Za-z0-9][A-Za-z0-9 ._/,'()-]*$/.test(value) && !/ $|^(true|false|null|yes|no|on|off)$/i.test(value) ? String(value) : JSON.stringify(value));
const defined = (fields) => Object.entries(fields).filter(([, value]) => value !== undefined);

function render(host, agent) {
  const fields = defined(host.fields(agent));
  if (host.toml) return `${fields.map(([key, value]) => `${key} = ${JSON.stringify(value)}`).join("\n")}\ndeveloper_instructions = '''\n${agent.body}'''\n`;
  const yaml = fields.map(([key, value]) => (Array.isArray(value) ? `${key}:\n${value.map((v) => `  - ${yamlScalar(v)}`).join("\n")}` : `${key}: ${yamlScalar(value)}`));
  return `---\n${yaml.join("\n")}\n---\n\n${agent.body.endsWith("\n") ? agent.body : `${agent.body}\n`}`;
}

function dropped(tool, agent) {
  const host = HOSTS[tool];
  const kept = ["name", "description", "body", ...host.uses];
  const lost = (key) => !kept.includes(key) || (key === "effort" && host.effortNeedsModel && !agent.model);
  return Object.keys(agent).filter(lost).map((field) => ({ tool, field }));
}

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

function main(argv) {
  const options = parseArgs(argv);
  const project = path.resolve(options["--project"]);
  if (!path.isAbsolute(options["--project"]) || !fs.existsSync(project) || fs.realpathSync(project) !== project) refuse("--project must be an absolute real directory.");
  const tools = options["--tools"].split(",");
  if (tools.some((tool) => !TOOLS.includes(tool))) refuse(`Unknown tool; expected ${TOOLS.join(",")}.`);
  let agent;
  try { agent = JSON.parse(fs.readFileSync(options["--input"], "utf8")); } catch { refuse("Input must be a readable JSON file."); }
  validate(agent);
  const plan = TOOLS.filter((tool) => tools.includes(tool)).map((tool) => {
    const relative = HOSTS[tool].path(agent.name);
    assertNoSymlink(project, relative);
    const content = render(HOSTS[tool], agent);
    const current = readOrNull(path.join(project, relative));
    return { tool, path: relative, content, operation: current === null ? "create" : current === content ? "unchanged" : "update" };
  });
  if (options["--check"]) {
    const drift = plan.filter((file) => file.operation !== "unchanged").map((file) => file.path);
    return { code: drift.length ? EXIT.REFUSED : EXIT.OK, result: { drift } };
  }
  const result = { files: plan.map(({ path: p, operation }) => ({ path: p, operation })), dropped: plan.flatMap((file) => dropped(file.tool, agent)) };
  if (!options["--plan"]) {
    // Every directory first, so a path that cannot exist fails before any file is written.
    const changed = plan.filter((f) => f.operation !== "unchanged");
    for (const file of changed) fs.mkdirSync(path.dirname(path.join(project, file.path)), { recursive: true });
    for (const file of changed) fs.writeFileSync(path.join(project, file.path), file.content);
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
