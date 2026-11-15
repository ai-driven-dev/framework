#!/usr/bin/env node
"use strict";
// Usage: node write-hook.cjs --project <abs dir> (--input <hook.json> | --remove <name>) [--plan] [--force]
// Host ids: claude,codex,cursor,copilot,antigravity,opencode,kilo, named in the input's `hosts`.
// Writes one hook as each host's native config entry, or a gateway plugin for a host that runs
// plugins, plus a copy of its script in that host's folder.
// Exit 0 ok, 1 refusal, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--plan", "--force"];
const VALUES = ["--project", "--input", "--remove"];
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// One command word, so the config never runs anything the script does not.
const RUNNER = /^[a-z][a-z0-9._-]*$/;
const EXTENSION = /^[a-z0-9]+$/;
const CONFIG_EXTENSION = "json";
const LINE_BREAK = /[\r\n]/;
const CRLF = /\r\n/g;
const MISSING = ["ENOENT", "ENOTDIR"];
const DEFAULT_TIMEOUT_SECONDS = 30;
const MS_PER_SECOND = 1000;
const GATEWAY_EVENTS = ["tool.execute.before"];
const CONFIG_VERSION = 1;
const SCRIPTS_FOLDER = "hooks";
const NOTHING_OWNED = JSON.stringify([]);

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isFilled = (value) => typeof value === "string" && value.trim() !== "";
const commandHandler = (hook) => ({ type: "command", command: hook.command, timeout: hook.timeout });
const withMatcher = (hook) => (hook.matcher === undefined ? {} : { matcher: hook.matcher });
const isEventMap = (hooks, isItem) => hooks === undefined
  || (isObject(hooks) && Object.values(hooks).every((items) => Array.isArray(items) && items.every(isItem)));

// Drops what `without` takes out of every event list; a list, or the map, only once emptied here.
function stripEvents(doc, without) {
  if (!doc.hooks) return;
  let emptied = false;
  for (const [event, items] of Object.entries(doc.hooks)) {
    const kept = items.map(without).filter(Boolean);
    if (kept.length) doc.hooks[event] = kept;
    else if (items.length) {
      delete doc.hooks[event];
      emptied = true;
    }
  }
  if (emptied && !Object.keys(doc.hooks).length) delete doc.hooks;
}

// Claude and Codex: each event lists groups, each group an optional matcher and its handlers.
const GROUPED = {
  isValid: (doc) => isObject(doc) && isEventMap(doc.hooks, (group) => isObject(group) && Array.isArray(group.hooks)),
  owned: (doc, ours) => Object.entries(doc.hooks ?? {}).flatMap(([event, groups]) => groups
    .map((group) => ({ event, matcher: group.matcher, hooks: group.hooks.filter(ours.owns) }))
    .filter((group) => group.hooks.length)),
  strip: (doc, ours) => stripEvents(doc, (group) => {
    if (!group.hooks.some(ours.owns)) return group;
    const kept = group.hooks.filter((handler) => !ours.owns(handler));
    return kept.length ? { ...group, hooks: kept } : null;
  }),
  add(doc, hook) {
    doc.hooks ??= {};
    (doc.hooks[hook.event] ??= []).push({ ...withMatcher(hook), hooks: [commandHandler(hook)] });
  },
  isEmpty: (doc) => !Object.keys(doc).length,
};

// Cursor: each event lists its handlers directly, under a versioned file.
const FLAT = {
  isValid: (doc) => isObject(doc) && isEventMap(doc.hooks, isObject),
  owned: (doc, ours) => Object.entries(doc.hooks ?? {}).flatMap(([event, handlers]) => handlers
    .filter(ours.owns).map((handler) => ({ event, handler }))),
  strip: (doc, ours) => stripEvents(doc, (handler) => (ours.owns(handler) ? null : handler)),
  add(doc, hook) {
    doc.version ??= CONFIG_VERSION;
    doc.hooks ??= {};
    (doc.hooks[hook.event] ??= []).push({ command: hook.command, timeout: hook.timeout, ...withMatcher(hook) });
  },
  isEmpty: (doc) => Object.keys(doc).every((key) => key === "version"),
};

// Antigravity: one top-level key per hook; only a tool event wraps its handlers in a matcher group.
const KEYED = {
  isValid: (doc) => isObject(doc) && Object.values(doc).every(isObject),
  owned: (doc, ours) => (doc[ours.name] === undefined ? [] : [doc[ours.name]]),
  strip: (doc, ours) => { delete doc[ours.name]; },
  add(doc, hook) {
    const handler = commandHandler(hook);
    doc[hook.name] = { [hook.event]: hook.takesMatcher ? [{ ...withMatcher(hook), hooks: [handler] }] : [handler] };
  },
  isEmpty: (doc) => !Object.keys(doc).length,
};

// Copilot: the whole file belongs to the hook it is named after.
const WHOLE = {
  isValid: isObject,
  owned: (doc) => (Object.keys(doc).length ? [doc] : []),
  strip: (doc) => { for (const key of Object.keys(doc)) delete doc[key]; },
  add(doc, hook) {
    doc.version = CONFIG_VERSION;
    doc.hooks = { [hook.event]: [{ type: "command", bash: hook.command, cwd: ".", timeoutSec: hook.timeout }] };
  },
  isEmpty: (doc) => !Object.keys(doc).length,
};

// Kilo and OpenCode run plugins, not commands: a generated plugin runs the script and turns
// its exit code into the host's answer. Exit 2 blocks with stderr as the reason; any other
// failure lets the tool run and says so on stderr.
function gatewayCore(hook, tool, script) {
  return `// Generated by write-hook.cjs for the hook ${hook.name}. Regenerate it rather than editing it.
import { spawn } from "node:child_process";
import path from "node:path";

const NAME = ${JSON.stringify(hook.name)};
const HOST = ${JSON.stringify(tool)};
const RUNNER = ${JSON.stringify(hook.runner)};
const SCRIPT = ${JSON.stringify(script)};
const MATCHER = ${JSON.stringify(hook.matcher ?? null)};
const TIMEOUT_MS = ${hook.timeout * MS_PER_SECOND};
const BLOCK = 2;

function runScript(directory, call) {
  return new Promise((resolve) => {
    const child = spawn(RUNNER, [path.join(directory, SCRIPT), HOST], { cwd: directory, timeout: TIMEOUT_MS });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.on("error", () => {});
    child.on("error", () => resolve({ code: null, stderr }));
    child.on("close", (code) => resolve({ code, stderr }));
    child.stdin.end(JSON.stringify(call));
  });
}

async function before(directory, call) {
  if (MATCHER !== null && !new RegExp(MATCHER).test(call.tool)) return;
  const result = await runScript(directory, call);
  if (result.code === BLOCK) throw new Error(result.stderr.trim() || \`Blocked by the hook \${NAME}.\`);
  if (result.code !== 0) console.error(\`The hook \${NAME} failed (\${result.code ?? "not started"}); the tool runs.\`);
}
`;
}

// OpenCode V1 calls `server`, V2 calls `setup`; each version calls only its own form.
const renderOpencode = (hook, tool, script) => `${gatewayCore(hook, tool, script)}
const server = async ({ directory }) => ({
  "tool.execute.before": (input, output) => before(directory, { tool: input.tool, args: output.args, sessionID: input.sessionID }),
});

export default {
  id: \`aidd-hook-\${NAME}\`,
  server,
  setup: async (ctx) => {
    const hook = await ctx.tool.hook("execute.before", (call) =>
      before(ctx.location.directory, { tool: call.tool, args: call.input, sessionID: call.sessionID }));
    return async () => { await hook.dispose(); };
  },
};
`;

const renderKilo = (hook, tool, script) => `${gatewayCore(hook, tool, script)}
export default {
  id: \`aidd-hook-\${NAME}\`,
  server: async ({ directory }) => ({
    "tool.execute.before": (input, output) => before(directory, { tool: input.tool, args: output.args, sessionID: input.sessionID }),
  }),
};
`;

// `locate` turns the script's path from the project root into what the host's command line resolves.
// Each event list is what the host documents; a tool event alone takes a matcher.
const HOSTS = {
  claude: {
    folder: ".claude",
    config: () => ".claude/settings.json",
    format: GROUPED,
    locate: (script) => `"$CLAUDE_PROJECT_DIR"/${script}`,
    events: ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "Notification", "SubagentStart", "SubagentStop", "PreCompact", "Stop"],
    matcherEvents: ["SessionStart", "SessionEnd", "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "Notification", "SubagentStart", "SubagentStop", "PreCompact"],
  },
  // Codex starts a hook from the session's folder, so the path goes through the repository root.
  codex: {
    folder: ".codex",
    config: () => ".codex/hooks.json",
    format: GROUPED,
    locate: (script) => `"$(git rev-parse --show-toplevel)/${script}"`,
    events: ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact", "SubagentStop", "Stop"],
    matcherEvents: ["SessionStart", "PreToolUse", "PostToolUse"],
  },
  cursor: {
    folder: ".cursor",
    config: () => ".cursor/hooks.json",
    format: FLAT,
    locate: (script) => `"$CURSOR_PROJECT_DIR"/${script}`,
    events: ["sessionStart", "sessionEnd", "beforeSubmitPrompt", "preToolUse", "postToolUse", "postToolUseFailure", "beforeShellExecution", "afterShellExecution", "beforeMCPExecution", "afterMCPExecution", "beforeReadFile", "afterFileEdit", "subagentStart", "subagentStop", "preCompact", "afterAgentResponse", "afterAgentThought", "stop"],
    matcherEvents: ["preToolUse", "postToolUse", "postToolUseFailure", "beforeShellExecution", "afterShellExecution", "beforeMCPExecution", "afterMCPExecution", "beforeReadFile", "afterFileEdit", "subagentStart", "subagentStop"],
  },
  // Copilot resolves `cwd: "."` to the repository root, even from a subfolder.
  copilot: {
    folder: ".github",
    config: (name) => `.github/hooks/${name}.${CONFIG_EXTENSION}`,
    format: WHOLE,
    locate: (script) => script,
    events: ["sessionStart", "sessionEnd", "userPromptSubmitted", "preToolUse", "permissionRequest", "postToolUse", "errorOccurred", "agentStop", "subagentStop"],
    matcherEvents: [],
  },
  // Antigravity starts a hook from the folder holding its hooks.json.
  antigravity: {
    folder: ".agents",
    config: () => ".agents/hooks.json",
    format: KEYED,
    locate: (script) => path.posix.relative(".agents", script),
    events: ["SessionStart", "PreInvocation", "PreToolUse", "PostToolUse", "PostInvocation", "Stop"],
    matcherEvents: ["PreToolUse", "PostToolUse"],
  },
  // A gateway's matcher is a pattern on the tool's name: `bash` in OpenCode V1 and Kilo, `shell` in V2.
  opencode: {
    folder: ".opencode",
    gateway: (name) => `.opencode/plugins/${name}.js`,
    render: renderOpencode,
    events: GATEWAY_EVENTS,
    matcherEvents: GATEWAY_EVENTS,
  },
  kilo: {
    folder: ".kilo",
    gateway: (name) => `.kilo/plugin/${name}.js`,
    render: renderKilo,
    events: GATEWAY_EVENTS,
    matcherEvents: GATEWAY_EVENTS,
  },
};
const TOOLS = Object.keys(HOSTS);

const scriptPath = (tool, name, extension) => `${HOSTS[tool].folder}/${SCRIPTS_FOLDER}/${name}.${extension}`;

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
  const sources = ["--input", "--remove"].filter((name) => options[name]);
  if (!options["--project"] || sources.length !== 1) throw new UsageError("--project and one of --input or --remove are required.");
  return options;
}

function realProject(value) {
  const isReal = path.isAbsolute(value) && fs.existsSync(value) && fs.realpathSync(value) === path.resolve(value);
  if (!isReal) refuse("--project must be an absolute real directory.");
  return path.resolve(value);
}

function readHook(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return refuse("Input must be a readable JSON file.");
  }
}

function assertName(name) {
  if (typeof name !== "string" || !KEBAB_CASE.test(name)) refuse("Name must be kebab-case.");
}

function isPattern(value) {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

function validateHost(tool, target) {
  const host = HOSTS[tool];
  if (!host) refuse(`Unknown host ${tool}; expected ${TOOLS.join(",")}.`);
  if (!isObject(target) || !host.events.includes(target.event)) refuse(`${tool}: unknown event; expected one of ${host.events.join(", ")}.`);
  if (target.matcher === undefined) return;
  if (!host.matcherEvents.includes(target.event)) refuse(`${tool}: ${target.event} takes no matcher.`);
  if (!isFilled(target.matcher) || LINE_BREAK.test(target.matcher)) refuse(`${tool}: matcher must be a non-empty single line.`);
  if (!isPattern(target.matcher)) refuse(`${tool}: matcher must be a valid pattern.`);
}

function validate(hook) {
  if (!isObject(hook)) refuse("Input must be a JSON object.");
  assertName(hook.name);
  if (typeof hook.runner !== "string" || !RUNNER.test(hook.runner)) refuse("Runner must be one command word, such as node or python3.");
  if (typeof hook.extension !== "string" || !EXTENSION.test(hook.extension) || hook.extension === CONFIG_EXTENSION) refuse("Extension must be one lowercase word other than json.");
  if (!isFilled(hook.script)) refuse("Script must be non-empty.");
  const timeout = hook.timeout ?? DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isInteger(timeout) || timeout < 1) refuse("Timeout must be a whole number of seconds, at least 1.");
  if (!isObject(hook.hosts) || !Object.keys(hook.hosts).length) refuse("Hosts must name at least one host.");
  for (const [tool, target] of Object.entries(hook.hosts)) validateHost(tool, target);
  return timeout;
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

function readConfig(project, tool, relative) {
  assertNoSymlink(project, relative);
  const text = readOrNull(path.join(project, relative));
  if (text === null) return { exists: false, doc: {} };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    refuse(`${relative} is not valid JSON; fix it by hand first.`);
  }
  if (!HOSTS[tool].format.isValid(doc)) refuse(`${relative} does not have the shape ${tool} documents.`);
  return { exists: true, doc };
}

// The writer owns an entry whose command runs its script from this host's folder.
function ownership(tool, name) {
  const marker = `${HOSTS[tool].folder}/${SCRIPTS_FOLDER}/${name}.`;
  return { name, owns: (handler) => typeof handler?.command === "string" && handler.command.includes(marker) };
}

const serialize = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

function planEntry(project, tool, hook) {
  const host = HOSTS[tool];
  const relative = host.config(hook.name);
  const { exists, doc } = readConfig(project, tool, relative);
  const ours = ownership(tool, hook.name);
  // A snapshot, not the entries: stripping and adding change the document they live in.
  const before = JSON.stringify(host.format.owned(doc, ours));
  host.format.strip(doc, ours);
  host.format.add(doc, hook);
  let operation = "update";
  if (!exists || before === NOTHING_OWNED) operation = "create";
  else if (before === JSON.stringify(host.format.owned(doc, ours))) operation = "unchanged";
  return { tool, path: relative, operation, content: serialize(doc) };
}

function planCopy(project, tool, relative, script) {
  assertNoSymlink(project, relative);
  const current = readOrNull(path.join(project, relative));
  let operation = "update";
  if (current === null) operation = "create";
  else if (current === script) operation = "unchanged";
  return { tool, path: relative, operation, content: script };
}

function planWrite(project, hook, timeout) {
  const tools = TOOLS.filter((tool) => tool in hook.hosts);
  return tools.flatMap((tool) => {
    const host = HOSTS[tool];
    const target = hook.hosts[tool];
    const script = scriptPath(tool, hook.name, hook.extension);
    const entry = { name: hook.name, runner: hook.runner, event: target.event, matcher: target.matcher, timeout };
    const native = host.gateway
      ? planCopy(project, tool, host.gateway(hook.name), host.render(entry, tool, script))
      : planEntry(project, tool, {
        ...entry,
        takesMatcher: host.matcherEvents.includes(target.event),
        command: `${hook.runner} ${host.locate(script)} ${tool}`,
      });
    return [native, planCopy(project, tool, script, hook.script)];
  });
}

function planGatewayRemoval(project, tool, name) {
  const relative = HOSTS[tool].gateway(name);
  assertNoSymlink(project, relative);
  if (readOrNull(path.join(project, relative)) === null) return [];
  return [{ tool, path: relative, operation: "delete", content: null }];
}

function planEntryRemoval(project, tool, name) {
  const host = HOSTS[tool];
  if (host.gateway) return planGatewayRemoval(project, tool, name);
  const relative = host.config(name);
  const { doc } = readConfig(project, tool, relative);
  const ours = ownership(tool, name);
  if (!host.format.owned(doc, ours).length) return [];
  host.format.strip(doc, ours);
  if (host.format.isEmpty(doc)) return [{ tool, path: relative, operation: "delete", content: null }];
  return [{ tool, path: relative, operation: "update", content: serialize(doc) }];
}

// Every copy of the script, whatever its extension, except the host's own config file.
function copiesOf(project, tool, name) {
  const folder = `${HOSTS[tool].folder}/${SCRIPTS_FOLDER}`;
  assertNoSymlink(project, folder);
  let entries;
  try {
    entries = fs.readdirSync(path.join(project, folder));
  } catch (error) {
    if (MISSING.includes(error.code)) return [];
    throw error;
  }
  const prefix = `${name}.`;
  return entries
    .filter((entry) => entry.startsWith(prefix))
    .filter((entry) => {
      const extension = entry.slice(prefix.length);
      return EXTENSION.test(extension) && extension !== CONFIG_EXTENSION;
    })
    .map((entry) => ({ tool, path: `${folder}/${entry}`, operation: "delete", content: null }));
}

function planRemoval(project, name) {
  assertName(name);
  return TOOLS.flatMap((tool) => [...planEntryRemoval(project, tool, name), ...copiesOf(project, tool, name)]);
}

function applyPlan(project, plan, force) {
  const changed = plan.filter((change) => change.operation !== "unchanged");
  const overwritten = changed.filter((change) => change.operation === "update").map((change) => change.path);
  if (overwritten.length && !force) refuse(`Would overwrite ${overwritten.join(", ")}; rerun with --force once approved.`);
  const written = changed.filter((change) => change.content !== null);
  // Every directory first, so a path that cannot exist fails before any file is written.
  for (const change of written) fs.mkdirSync(path.dirname(path.join(project, change.path)), { recursive: true });
  for (const change of written) fs.writeFileSync(path.join(project, change.path), change.content);
  for (const change of changed.filter((item) => item.content === null)) fs.unlinkSync(path.join(project, change.path));
}

function main(argv) {
  const options = parseArgs(argv);
  const project = realProject(options["--project"]);
  const removing = Boolean(options["--remove"]);
  let plan;
  if (removing) plan = planRemoval(project, options["--remove"]);
  else {
    const hook = readHook(options["--input"]);
    plan = planWrite(project, hook, validate(hook));
  }
  // Removing was approved as such; only a write can overwrite without asking.
  if (!options["--plan"]) applyPlan(project, plan, removing || options["--force"]);
  return { changes: plan.map((change) => ({ tool: change.tool, path: change.path, operation: change.operation })) };
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

run();
