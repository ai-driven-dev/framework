#!/usr/bin/env node
"use strict";
// Usage: node write-agent.cjs --project <abs dir> --tools <ids> --input <agent.json> [--plan] [--force]
// Tool ids: claude,cursor,copilot,antigravity,codex,opencode,kilo,kiro,kimi.
// Renders one canonical agent as each host's native file, with the key mapping of the aidd CLI.
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
const TOML_DELIMITER = "'''";
// A YAML plain scalar that reads back as the same string; anything else is double-quoted, since Cursor keeps single quotes as text.
const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9 ._/,'()-]*$/;
const YAML_KEYWORD = /^(true|false|null|yes|no|on|off)$/i;
const MISSING = ["ENOENT", "ENOTDIR"];

// A host that spells effort inside the model value loses an effort given without a model.
const withEffort = (open, close = "") => (agent) =>
  agent.model && agent.effort ? `${agent.model}${open}${agent.effort}${close}` : agent.model;

// Each host keeps its own keys only, and `effort` becomes its own spelling of it.
// Claude also keeps the keys only it reads, which the CLI drops, so an existing agent survives a rewrite.
const HOSTS = {
  claude: {
    path: (name) => `.claude/agents/${name}.md`,
    fields: (a) => ({
      name: a.name,
      description: a.description,
      model: a.model,
      effort: a.effort,
      tools: a.tools,
      color: a.color,
      permissionMode: a.permissionMode,
      disallowedTools: a.disallowedTools,
    }),
    uses: ["model", "effort", "tools", "color", "permissionMode", "disallowedTools"],
  },
  cursor: {
    path: (name) => `.cursor/agents/${name}.md`,
    fields: (a) => ({ name: a.name, description: a.description, model: withEffort("[effort=", "]")(a) }),
    uses: ["model", "effort"],
    effortNeedsModel: true,
  },
  copilot: {
    path: (name) => `.github/agents/${name}.agent.md`,
    fields: (a) => ({
      name: a.name,
      description: a.description,
      model: a.model,
      reasoningEffort: a.effort,
      "include-custom-instructions": a["include-custom-instructions"] ?? true,
    }),
    uses: ["model", "effort", "include-custom-instructions"],
  },
  antigravity: {
    path: (name) => `.agents/agents/${name}/agent.md`,
    fields: (a) => ({ name: a.name, description: a.description, model: "inherit", tools: toolList(a.tools) }),
    uses: ["tools"],
  },
  codex: {
    path: (name) => `.codex/agents/${name}.toml`,
    fields: (a) => ({ name: a.name, description: a.description, model: a.model, model_reasoning_effort: a.effort }),
    uses: ["model", "effort"],
    toml: true,
  },
  opencode: {
    path: (name) => `.opencode/agents/${name}.md`,
    fields: (a) => ({ description: a.description, model: withEffort("#")(a), mode: "subagent" }),
    uses: ["model", "effort"],
    effortNeedsModel: true,
  },
  kilo: {
    path: (name) => `.kilo/agents/${name}.md`,
    fields: (a) => ({ description: a.description, model: a.model, variant: a.effort, mode: "subagent" }),
    uses: ["model", "effort"],
  },
  // Kiro's model ids and tool names are not Claude's, so neither is written; `tools` is always `*`, as in the CLI's Kiro profile.
  kiro: {
    path: (name) => `.kiro/agents/${name}.md`,
    fields: (a) => ({ name: a.name, description: a.description, tools: ["*"] }),
    uses: [],
  },
  // Kimi documents no `model`. A tool with no Kimi name is left out, as in the CLI's Kimi profile.
  kimi: {
    path: (name) => `.kimi-code/agents/${name}.md`,
    fields: (a) => ({ name: a.name, description: a.description, tools: kimiTools(a.tools) }),
    uses: ["tools"],
  },
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
  if (tools.some((tool) => !TOOLS.includes(tool))) refuse(`Unknown tool; expected ${TOOLS.join(",")}.`);
  return TOOLS.filter((tool) => tools.includes(tool));
}

function readAgent(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return refuse("Input must be a readable JSON file.");
  }
}

const isSingleLine = (value) => typeof value === "string" && !LINE_BREAK.test(value);
const isFilled = (value) => typeof value === "string" && value.trim() !== "";
const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

function valueAccepted(key, value) {
  if (key === "tools" && isStringList(value)) return true;
  if (key === "include-custom-instructions") return typeof value === "boolean";
  return typeof value === "string";
}

function validate(agent) {
  if (!agent || typeof agent !== "object" || Array.isArray(agent)) refuse("Input must be a JSON object.");
  if (typeof agent.name !== "string" || !KEBAB_CASE.test(agent.name)) refuse("Name must be kebab-case.");
  if (!isFilled(agent.description) || !isSingleLine(agent.description)) refuse("Description must be a non-empty single line.");
  if (!isFilled(agent.body)) refuse("Body must be non-empty.");
  if (agent.body.includes(TOML_DELIMITER)) refuse(`Body must not contain ${TOML_DELIMITER} (the Codex delimiter).`);
  for (const [key, value] of Object.entries(agent)) {
    if (!valueAccepted(key, value)) refuse(`Field ${key} has an unsupported value.`);
  }
}

function toolList(tools) {
  if (tools === undefined) return undefined;
  const list = Array.isArray(tools) ? tools : tools.split(",").map((tool) => tool.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

// Kimi's own name for each Claude tool, per https://www.kimi.com/code/docs/en/kimi-code-cli/reference/tools.html.
const KIMI_TOOLS = new Map([
  ["Read", "Read"], ["Write", "Write"], ["Edit", "Edit"], ["Grep", "Grep"], ["Glob", "Glob"], ["Bash", "Bash"],
  ["WebFetch", "FetchURL"], ["WebSearch", "WebSearch"], ["Task", "Agent"], ["Agent", "Agent"], ["TodoWrite", "TodoList"],
  ["AskUserQuestion", "AskUserQuestion"], ["Skill", "Skill"], ["ExitPlanMode", "ExitPlanMode"], ["TaskOutput", "TaskOutput"], ["TaskStop", "TaskStop"],
]);

// Kimi gives every tool to an agent with no `tools`, so none is written then; a declared list that maps to nothing stays `[]`, which narrows and never widens. An MCP tool keeps its name.
const MCP_PREFIX = "mcp__";

function kimiTools(tools) {
  const declared = toolList(tools);
  if (!declared) return undefined;
  const named = declared.flatMap((tool) => (tool.startsWith(MCP_PREFIX) ? tool : (KIMI_TOOLS.get(tool) ?? [])));
  return [...new Set(named)];
}

function yamlScalar(value) {
  if (typeof value === "boolean") return String(value);
  const plain = PLAIN_SCALAR.test(value) && !value.endsWith(" ") && !YAML_KEYWORD.test(value);
  return plain ? value : JSON.stringify(value);
}

function yamlLine([key, value]) {
  if (!Array.isArray(value)) return `${key}: ${yamlScalar(value)}`;
  if (!value.length) return `${key}: []`;
  return `${key}:\n${value.map((item) => `  - ${yamlScalar(item)}`).join("\n")}`;
}

function render(host, agent) {
  const fields = Object.entries(host.fields(agent)).filter(([, value]) => value !== undefined);
  if (host.toml) {
    const keys = fields.map(([key, value]) => `${key} = ${JSON.stringify(value)}`).join("\n");
    return `${keys}\ndeveloper_instructions = ${TOML_DELIMITER}\n${agent.body}${TOML_DELIMITER}\n`;
  }
  const body = agent.body.endsWith("\n") ? agent.body : `${agent.body}\n`;
  return `---\n${fields.map(yamlLine).join("\n")}\n---\n\n${body}`;
}

function droppedFields(tool, agent) {
  const host = HOSTS[tool];
  const kept = ["name", "description", BODY, ...host.uses];
  const lost = (key) => !kept.includes(key) || (key === "effort" && host.effortNeedsModel && !agent.model);
  return Object.keys(agent).filter(lost).map((field) => ({ tool, field }));
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

function planFiles(project, tools, agent) {
  return tools.map((tool) => {
    const relative = HOSTS[tool].path(agent.name);
    assertNoSymlink(project, relative);
    const content = render(HOSTS[tool], agent);
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
  const agent = readAgent(options["--input"]);
  validate(agent);
  const plan = planFiles(project, tools, agent);
  if (!options["--plan"]) applyPlan(project, plan, options["--force"]);
  return {
    files: plan.map((file) => ({ path: file.path, operation: file.operation })),
    dropped: plan.flatMap((file) => droppedFields(file.tool, agent)),
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

module.exports = { TOOLS, KIMI_TOOLS };
