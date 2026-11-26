#!/usr/bin/env node
"use strict";
// Usage: node write-hook.cjs --describe [--hosts a,b]
//        node write-hook.cjs --project <abs dir> (--input <hook.json> | --remove <name>) [--plan] [--force]
// Writes one hook as each named host's native entry, in the format that host documents: a config
// entry and its own script for a host that runs commands, a plugin file for a host that runs plugins.
// HOSTS is the only per-host mapping; --describe prints it, and validation reads the same table.
// Exit 0 ok, 1 refusal, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
// Limits: owns a config entry only when its command names the script under that host's hooks/ folder;
// writes no Windows-only command; reads a config as UTF-8 JSON and refuses JSONC comments.
const fs = require("node:fs");
const path = require("node:path");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--plan", "--force", "--describe"];
const VALUES = ["--project", "--input", "--remove", "--hosts"];
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// One command word, so the config never runs anything the script does not.
const RUNNER = /^[a-z][a-z0-9._-]*$/;
const EXTENSION = /^[a-z0-9]+$/;
const CONFIG_EXTENSION = "json";
const LINE_BREAK = /[\r\n]/;
const CRLF = /\r\n/g;
const MISSING = ["ENOENT", "ENOTDIR"];
const DEFAULT_TIMEOUT_SECONDS = 30;
const CONFIG_VERSION = 1;
const SCRIPTS_FOLDER = "hooks";
const NOTHING_OWNED = JSON.stringify([]);
const COMMAND_FIELDS = ["event", "matcher", "runner", "extension", "script", "timeout"];

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

// Copilot and Kiro: the whole file belongs to the hook it is named after.
const whole = (build) => ({
  isValid: isObject,
  owned: (doc) => (Object.keys(doc).length ? [doc] : []),
  strip: (doc) => { for (const key of Object.keys(doc)) delete doc[key]; },
  add(doc, hook) { Object.assign(doc, build(hook)); },
  isEmpty: (doc) => !Object.keys(doc).length,
});
const COPILOT = whole((hook) => ({
  version: CONFIG_VERSION,
  hooks: { [hook.event]: [{ type: "command", bash: hook.command, cwd: ".", timeoutSec: hook.timeout }] },
}));
const KIRO = whole((hook) => ({
  version: "v1",
  hooks: [{ name: hook.name, trigger: hook.event, ...withMatcher(hook), action: { type: "command", command: hook.command }, timeout: hook.timeout }],
}));

const capture = (file) => `capture:${file}`;
const NOT_DOCUMENTED = "not documented";
const NO_TRUST = "none documented";
const NAMES = "<name>";

// The one mapping. Every fact carries `source`: a vendor URL, or a capture under
// scripts/__tests__/fixtures/hook-payloads/, cited only when it was recorded through the route written here.
// A moment's `matcher` says whether its event takes one; `payload` names the fields a hook reads.
const moment = (event, matcher, source, payload) => ({ event, matcher, ...(payload ? { payload } : {}), source });
const effect = (answer, at, source, pin) => ({ answer, at, source, ...pin });
const NO_EFFECT = null;

const CLAUDE_DOC = "https://code.claude.com/docs/en/hooks";
const CODEX_DOC = "https://developers.openai.com/codex/hooks";
const CURSOR_DOC = "https://cursor.com/docs/hooks";
const COPILOT_DOC = "https://docs.github.com/en/copilot/reference/hooks-configuration";
const ANTIGRAVITY_DOC = "https://antigravity.google/docs/hooks";
const KIRO_DOC = "https://kiro.dev/docs/hooks/";
const OPENCODE_DOC = "https://opencode.ai/docs/plugins/";
const KILO_DOC = "https://kilo.ai/docs/automate/extending/plugins";

const TOOL_PAYLOAD = ["tool_name", "tool_input"];
const RESULT_PAYLOAD = [...TOOL_PAYLOAD, "tool_response"];

// The plugin hosts hand a plugin arguments, not stdin: the fields are those arguments' paths.
const pluginMoments = (doc, prefix, v2) => ({
  "session-start": moment("session.created", false, capture(`${prefix}-session.created.json`), ["properties.sessionID"]),
  prompt: { ...moment("chat.message", false, capture(`${prefix}-chat.message.json`), ["input.sessionID", "output.parts"]), ...(v2 && { v2: moment("prompt", false, capture("opencode-v2-prompt.json"), ["sessionID", "prompt"]) }) },
  "before-tool": { ...moment("tool.execute.before", false, capture(`${prefix}-tool.execute.before.json`), ["call.tool", "output.args"]), ...(v2 && { v2: moment("execute.before", false, capture("opencode-v2-execute.before.json"), ["tool", "input"]) }) },
  "after-tool": { ...moment("tool.execute.after", false, capture(`${prefix}-tool.execute.after.json`), ["call.tool", "call.args", "output.output"]), ...(v2 && { v2: moment("execute.after", false, capture("opencode-v2-execute.after.json"), ["tool", "input", "result"]) }) },
  stop: { ...moment("session.idle", false, capture(`${prefix}-session.idle.json`), ["properties.sessionID"]), ...(v2 && { v2: moment("experimental.idle", false, capture("opencode-v2-experimental.idle.json"), ["sessionID"]) }) },
  "session-end": null,
});

const HOSTS = {
  claude: {
    doc: CLAUDE_DOC,
    config: { path: ".claude/settings.json", shape: "grouped: each event lists groups of a matcher and handlers", source: CLAUDE_DOC },
    cwd: { value: "$CLAUDE_PROJECT_DIR", source: CLAUDE_DOC },
    trust: { value: "workspace trust", source: CLAUDE_DOC },
    shell: { value: "Bash", source: capture("claude-PreToolUse.json") },
    moments: {
      "session-start": moment("SessionStart", true, CLAUDE_DOC),
      prompt: moment("UserPromptSubmit", false, CLAUDE_DOC),
      "before-tool": moment("PreToolUse", true, capture("claude-PreToolUse.json"), TOOL_PAYLOAD),
      "after-tool": moment("PostToolUse", true, capture("claude-PostToolUse.json"), RESULT_PAYLOAD),
      stop: moment("Stop", false, capture("claude-Stop.json"), ["stop_hook_active"]),
      "session-end": moment("SessionEnd", true, CLAUDE_DOC),
    },
    effects: {
      inform: effect("hookSpecificOutput.additionalContext", ["SessionStart"], CLAUDE_DOC),
      block: effect('exit 2 with the reason on stderr, or hookSpecificOutput.permissionDecision "deny"', ["PreToolUse"], capture("claude-PreToolUse.json"), { key: "hookSpecificOutput.permissionDecision" }),
      ask: effect('hookSpecificOutput.permissionDecision "ask"', ["PreToolUse"], CLAUDE_DOC),
      continue: effect('decision "block"; read stop_hook_active', ["Stop"], capture("claude-Stop.json"), { key: "decision" }),
    },
  },
  codex: {
    doc: CODEX_DOC,
    config: { path: ".codex/hooks.json", shape: "grouped: each event lists groups of a matcher and handlers", source: CODEX_DOC },
    cwd: { value: "the session's folder; reach the project through git rev-parse --show-toplevel", source: CODEX_DOC },
    trust: { value: "review in /hooks after each change", source: CODEX_DOC },
    shell: { value: "Bash", source: capture("codex-PreToolUse.json") },
    moments: {
      "session-start": moment("SessionStart", true, CODEX_DOC),
      prompt: moment("UserPromptSubmit", false, CODEX_DOC),
      "before-tool": moment("PreToolUse", true, capture("codex-PreToolUse.json"), TOOL_PAYLOAD),
      "after-tool": moment("PostToolUse", true, capture("codex-PostToolUse.json"), RESULT_PAYLOAD),
      stop: moment("Stop", false, capture("codex-Stop.json"), ["stop_hook_active"]),
      "session-end": moment("SessionEnd", false, CODEX_DOC),
    },
    effects: {
      inform: effect("hookSpecificOutput.additionalContext, not at Stop", ["SessionStart"], capture("codex-SessionStart.json"), { key: "hookSpecificOutput.additionalContext" }),
      block: effect('hookSpecificOutput.permissionDecision "deny", or exit 2', ["PreToolUse"], capture("codex-PreToolUse.json"), { key: "hookSpecificOutput.permissionDecision" }),
      ask: NO_EFFECT,
      continue: effect('decision "block"', ["Stop"], capture("codex-Stop.json"), { key: "decision" }),
    },
  },
  cursor: {
    doc: CURSOR_DOC,
    config: { path: ".cursor/hooks.json", shape: "flat: each event lists handlers, under version 1", source: CURSOR_DOC },
    cwd: { value: "the project root", source: CURSOR_DOC },
    trust: { value: "a trusted workspace", source: CURSOR_DOC },
    shell: { value: "Shell", source: capture("cursor-postToolUse.json") },
    moments: {
      "session-start": moment("sessionStart", false, CURSOR_DOC),
      prompt: moment("beforeSubmitPrompt", false, CURSOR_DOC),
      "before-tool": moment("preToolUse", true, CURSOR_DOC, TOOL_PAYLOAD),
      "after-tool": moment("postToolUse", true, capture("cursor-postToolUse.json"), [...TOOL_PAYLOAD, "tool_output"]),
      stop: moment("stop", false, capture("cursor-stop.json"), ["loop_count"]),
      "session-end": moment("sessionEnd", false, CURSOR_DOC),
    },
    effects: {
      inform: effect("additional_context", ["sessionStart", "postToolUse"], CURSOR_DOC),
      block: effect('exit 2, or permission "deny"', ["preToolUse"], CURSOR_DOC),
      ask: NO_EFFECT,
      continue: effect("followup_message; read loop_count", ["stop"], capture("cursor-stop.json"), { key: "followup_message" }),
    },
  },
  copilot: {
    doc: COPILOT_DOC,
    config: { path: `.github/hooks/${NAMES}.json`, shape: "the whole file: version 1, bash, cwd \".\", timeoutSec", source: COPILOT_DOC },
    cwd: { value: "the repository root", source: COPILOT_DOC },
    trust: { value: "folder trust", source: COPILOT_DOC },
    shell: { value: null, source: COPILOT_DOC },
    moments: {
      "session-start": moment("sessionStart", false, COPILOT_DOC),
      prompt: moment("userPromptSubmitted", false, COPILOT_DOC),
      "before-tool": moment("preToolUse", true, COPILOT_DOC, ["toolName", "toolArgs"]),
      "after-tool": moment("postToolUse", true, COPILOT_DOC),
      stop: moment("agentStop", false, COPILOT_DOC, ["stop_hook_active"]),
      "session-end": moment("sessionEnd", false, COPILOT_DOC),
    },
    effects: {
      inform: effect("additionalContext", ["sessionStart", "postToolUse"], COPILOT_DOC),
      block: effect('permissionDecision "deny", or exit 2', ["preToolUse"], COPILOT_DOC),
      ask: effect('permissionDecision "ask"', ["preToolUse"], COPILOT_DOC),
      continue: effect('decision "block"; read stop_hook_active', ["agentStop"], COPILOT_DOC),
    },
  },
  antigravity: {
    doc: ANTIGRAVITY_DOC,
    config: { path: ".agents/hooks.json", shape: "one key per hook; a tool event wraps its handlers in a matcher group", source: ANTIGRAVITY_DOC },
    cwd: { value: ".agents/, the folder holding hooks.json", source: ANTIGRAVITY_DOC },
    trust: { value: NOT_DOCUMENTED, source: ANTIGRAVITY_DOC },
    shell: { value: "run_command", source: capture("antigravity-PreToolUse.json") },
    moments: {
      "session-start": moment("SessionStart", false, ANTIGRAVITY_DOC),
      prompt: null,
      "before-tool": moment("PreToolUse", true, capture("antigravity-PreToolUse.json"), ["toolCall.name", "toolCall.args"]),
      "after-tool": moment("PostToolUse", true, capture("antigravity-PostToolUse.json"), ["toolCall.name", "toolCall.args"]),
      stop: moment("Stop", false, ANTIGRAVITY_DOC),
      "session-end": null,
    },
    effects: {
      inform: effect("injectSteps with a systemMessage", ["SessionStart"], capture("antigravity-SessionStart.json"), { key: "injectSteps" }),
      block: effect('decision "deny"', ["PreToolUse"], capture("antigravity-PreToolUse.json"), { key: "decision" }),
      ask: effect('decision "ask"', ["PreToolUse"], ANTIGRAVITY_DOC),
      continue: effect('decision "continue"', ["Stop"], ANTIGRAVITY_DOC),
    },
  },
  kiro: {
    doc: KIRO_DOC,
    config: { path: `.kiro/hooks/${NAMES}.json`, shape: 'the whole file: {version: "v1", hooks: [{name, trigger, matcher?, action: {type: "command", command}, timeout}]}', source: KIRO_DOC },
    cwd: { value: "the project root", source: KIRO_DOC },
    trust: { value: NO_TRUST, source: KIRO_DOC },
    shell: { value: "execute_bash", source: capture("kiro-PreToolUse.json") },
    moments: {
      "session-start": moment("SessionStart", false, KIRO_DOC),
      prompt: moment("UserPromptSubmit", false, capture("kiro-UserPromptSubmit.json"), ["prompt"]),
      "before-tool": moment("PreToolUse", true, capture("kiro-PreToolUse.json"), TOOL_PAYLOAD),
      "after-tool": moment("PostToolUse", true, capture("kiro-PostToolUse.json"), RESULT_PAYLOAD),
      stop: moment("Stop", false, KIRO_DOC),
      "session-end": moment("SessionEnd", false, KIRO_DOC),
    },
    effects: {
      inform: effect("stdout, added to the context", ["SessionStart"], capture("kiro-SessionStart.json"), { text: true }),
      block: effect("exit 2 with the reason on stderr", ["PreToolUse"], capture("kiro-PreToolUse.json"), { exit: 2 }),
      ask: NO_EFFECT,
      continue: effect('decision "block", once', ["Stop"], capture("kiro-Stop.json"), { key: "decision" }),
    },
  },
  opencode: {
    doc: OPENCODE_DOC,
    plugin: { path: `.opencode/plugins/${NAMES}.js`, shape: "V1 server hooks and V2 setup hooks; filter on the tool in code", source: OPENCODE_DOC },
    cwd: { value: "the directory argument, ctx.location.directory in V2", source: OPENCODE_DOC },
    trust: { value: NO_TRUST, source: OPENCODE_DOC },
    shell: { value: "bash", v2: "shell", source: capture("opencode-tool.execute.before.json") },
    moments: pluginMoments(OPENCODE_DOC, "opencode", true),
    effects: {
      inform: effect("experimental.chat.system.transform, context in V2", ["experimental.chat.system.transform"], OPENCODE_DOC),
      block: effect("throw in the before hook", ["tool.execute.before"], OPENCODE_DOC),
      ask: NO_EFFECT,
      continue: NO_EFFECT,
    },
  },
  kilo: {
    doc: KILO_DOC,
    plugin: { path: `.kilo/plugin/${NAMES}.js`, shape: "V1 server hooks only; filter on the tool in code", source: KILO_DOC },
    cwd: { value: "the directory argument", source: KILO_DOC },
    trust: { value: NO_TRUST, source: KILO_DOC },
    shell: { value: "bash", source: capture("kilo-tool.execute.before.json") },
    moments: pluginMoments(KILO_DOC, "kilo", false),
    effects: {
      inform: effect("experimental.chat.system.transform", ["experimental.chat.system.transform"], KILO_DOC),
      block: effect("throw in tool.execute.before", ["tool.execute.before"], KILO_DOC),
      ask: NO_EFFECT,
      continue: NO_EFFECT,
    },
  },
};
const TOOLS = Object.keys(HOSTS);

// What writing needs beyond the facts. `locate` turns the script's path from the project root into
// what the host's command line resolves.
const WRITERS = {
  claude: { format: GROUPED, locate: (script) => `"$CLAUDE_PROJECT_DIR"/${script}` },
  codex: { format: GROUPED, locate: (script) => `"$(git rev-parse --show-toplevel)/${script}"` },
  cursor: { format: FLAT, locate: (script) => `"$CURSOR_PROJECT_DIR"/${script}` },
  copilot: { format: COPILOT, locate: (script) => script },
  antigravity: { format: KEYED, locate: (script) => path.posix.relative(".agents", script) },
  kiro: { format: KIRO, locate: (script) => script },
};

const configPath = (tool, name) => (HOSTS[tool].config ?? HOSTS[tool].plugin).path.replace(NAMES, name);
const folderOf = (tool) => configPath(tool, "").split("/")[0];
const scriptPath = (tool, name, extension) => `${folderOf(tool)}/${SCRIPTS_FOLDER}/${name}.${extension}`;
const momentOf = (tool, event) => Object.values(HOSTS[tool].moments).find((item) => item?.event === event);

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
  if (options["--describe"]) {
    if (Object.keys(options).some((name) => !["--describe", "--hosts"].includes(name))) throw new UsageError("--describe takes only --hosts.");
    return options;
  }
  if ("--hosts" in options) throw new UsageError("--hosts goes with --describe.");
  const sources = ["--input", "--remove"].filter((name) => options[name]);
  if (!options["--project"] || sources.length !== 1) throw new UsageError("--project and one of --input or --remove are required.");
  return options;
}

function describe(list) {
  const ids = list ? list.split(",") : TOOLS;
  const unknown = ids.find((id) => !HOSTS[id]);
  if (unknown) refuse(`Unknown host ${unknown}; expected ${TOOLS.join(",")}.`);
  return { hosts: Object.fromEntries(TOOLS.filter((id) => ids.includes(id)).map((id) => [id, HOSTS[id]])) };
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

function validateMatcher(tool, target) {
  if (target.matcher === undefined) return;
  if (!momentOf(tool, target.event).matcher) refuse(`${tool}: ${target.event} takes no matcher.`);
  if (!isFilled(target.matcher) || LINE_BREAK.test(target.matcher)) refuse(`${tool}: matcher must be a non-empty single line.`);
  if (!isPattern(target.matcher)) refuse(`${tool}: matcher must be a valid pattern.`);
}

function validateCommandHost(tool, target) {
  if (Object.keys(target).some((field) => !COMMAND_FIELDS.includes(field))) refuse(`${tool}: runs commands; give ${COMMAND_FIELDS.join(", ")}, no plugin.`);
  const events = Object.values(HOSTS[tool].moments).filter(Boolean).map((item) => item.event);
  if (!events.includes(target.event)) refuse(`${tool}: unknown event; expected one of ${events.join(", ")}.`);
  validateMatcher(tool, target);
  if (typeof target.runner !== "string" || !RUNNER.test(target.runner)) refuse(`${tool}: runner must be one command word, such as node or python3.`);
  if (typeof target.extension !== "string" || !EXTENSION.test(target.extension) || target.extension === CONFIG_EXTENSION) refuse(`${tool}: extension must be one lowercase word other than json.`);
  if (!isFilled(target.script)) refuse(`${tool}: script must be non-empty.`);
  const timeout = target.timeout ?? DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isInteger(timeout) || timeout < 1) refuse(`${tool}: timeout must be a whole number of seconds, at least 1.`);
}

function validatePluginHost(tool, target) {
  if (Object.keys(target).some((field) => field !== "plugin")) refuse(`${tool}: runs a plugin; give plugin alone, no ${COMMAND_FIELDS.join(", ")}.`);
  if (!isFilled(target.plugin)) refuse(`${tool}: plugin must be the non-empty plugin text.`);
}

function validate(hook) {
  if (!isObject(hook)) refuse("Input must be a JSON object.");
  assertName(hook.name);
  if (!isObject(hook.hosts) || !Object.keys(hook.hosts).length) refuse("Hosts must name at least one host.");
  for (const [tool, target] of Object.entries(hook.hosts)) {
    if (!HOSTS[tool]) refuse(`Unknown host ${tool}; expected ${TOOLS.join(",")}.`);
    if (!isObject(target)) refuse(`${tool}: the target must be an object.`);
    if (HOSTS[tool].plugin) validatePluginHost(tool, target);
    else validateCommandHost(tool, target);
  }
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
  if (!WRITERS[tool].format.isValid(doc)) refuse(`${relative} does not have the shape ${tool} documents.`);
  return { exists: true, doc };
}

// The writer owns an entry whose command runs its script from this host's folder.
function ownership(tool, name) {
  const marker = `${folderOf(tool)}/${SCRIPTS_FOLDER}/${name}.`;
  return { name, owns: (handler) => typeof handler?.command === "string" && handler.command.includes(marker) };
}

const serialize = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

function planEntry(project, tool, hook) {
  const { format } = WRITERS[tool];
  const relative = configPath(tool, hook.name);
  const { exists, doc } = readConfig(project, tool, relative);
  const ours = ownership(tool, hook.name);
  // A snapshot, not the entries: stripping and adding change the document they live in.
  const before = JSON.stringify(format.owned(doc, ours));
  format.strip(doc, ours);
  format.add(doc, hook);
  let operation = "update";
  if (!exists || before === NOTHING_OWNED) operation = "create";
  else if (before === JSON.stringify(format.owned(doc, ours))) operation = "unchanged";
  return { tool, path: relative, operation, content: serialize(doc) };
}

function planCopy(project, tool, relative, content) {
  assertNoSymlink(project, relative);
  const current = readOrNull(path.join(project, relative));
  let operation = "update";
  if (current === null) operation = "create";
  else if (current === content) operation = "unchanged";
  return { tool, path: relative, operation, content };
}

function planWrite(project, hook) {
  return TOOLS.filter((tool) => tool in hook.hosts).flatMap((tool) => {
    const target = hook.hosts[tool];
    if (HOSTS[tool].plugin) return [planCopy(project, tool, configPath(tool, hook.name), target.plugin)];
    const script = scriptPath(tool, hook.name, target.extension);
    const entry = planEntry(project, tool, {
      name: hook.name,
      event: target.event,
      matcher: target.matcher,
      takesMatcher: momentOf(tool, target.event).matcher,
      timeout: target.timeout ?? DEFAULT_TIMEOUT_SECONDS,
      command: `${target.runner} ${WRITERS[tool].locate(script)}`,
    });
    return [entry, planCopy(project, tool, script, target.script)];
  });
}

function planPluginRemoval(project, tool, name) {
  const relative = configPath(tool, name);
  assertNoSymlink(project, relative);
  if (readOrNull(path.join(project, relative)) === null) return [];
  return [{ tool, path: relative, operation: "delete", content: null }];
}

function planEntryRemoval(project, tool, name) {
  if (HOSTS[tool].plugin) return planPluginRemoval(project, tool, name);
  const { format } = WRITERS[tool];
  const relative = configPath(tool, name);
  const { doc } = readConfig(project, tool, relative);
  const ours = ownership(tool, name);
  if (!format.owned(doc, ours).length) return [];
  format.strip(doc, ours);
  if (format.isEmpty(doc)) return [{ tool, path: relative, operation: "delete", content: null }];
  return [{ tool, path: relative, operation: "update", content: serialize(doc) }];
}

// Every copy of the script, whatever its extension, except the host's own config file.
function copiesOf(project, tool, name) {
  if (HOSTS[tool].plugin) return [];
  const folder = `${folderOf(tool)}/${SCRIPTS_FOLDER}`;
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
  if (options["--describe"]) return describe(options["--hosts"]);
  const project = realProject(options["--project"]);
  const removing = Boolean(options["--remove"]);
  let plan;
  if (removing) plan = planRemoval(project, options["--remove"]);
  else {
    const hook = readHook(options["--input"]);
    validate(hook);
    plan = planWrite(project, hook);
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
