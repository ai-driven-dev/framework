"use strict";
/**
 * Claude Code's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; this one ships in
 * the plugin tree. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOST = "claude";
const EVENTS = new Map([
  ["SessionStart", "SessionStart"],
  ["PreToolUse", "PreToolUse"],
  ["PostToolUse", "PostToolUse"],
  ["Stop", "Stop"],
]);
const WRITES = new Set(["Write", "Edit"]);
const SHELLS = new Set(["Bash", "PowerShell"]);

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

/** What a Write replaced, as the host says it: the whole file before it, or nothing when the Write
 * created the file. Undefined when the host says neither. */
function replacedByWrite(response) {
  if (typeof response?.originalFile === "string") return response.originalFile;
  return response?.type === "create" && response.originalFile === null ? "" : undefined;
}

function writtenFiles(tool, input, cwd, response) {
  if (!WRITES.has(tool) || typeof input?.file_path !== "string") return [];
  const file = { path: path.resolve(cwd, input.file_path) };
  // A write carries the whole file; an edit carries fragments of it, never `content`.
  if (typeof input.content === "string") file.content = input.content;
  // What this write put in the file: the whole of a Write, the replacement of an Edit.
  const written = input.content ?? input.new_string;
  if (typeof written === "string") file.written = written;
  // What it replaced: an Edit's old string, context lines it repeats included; a Write's former file.
  const replaced = typeof input.content === "string" ? replacedByWrite(response) : input.old_string;
  if (typeof replaced === "string") file.replaced = replaced;
  return [file];
}

/** Before a tool runs nothing is written yet: only where it is about to write is known, so a file
 * carries its path and no text. */
function filesOf(event, files) {
  return event === "PreToolUse" ? files.map(({ path }) => ({ path })) : files;
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  const event = raw === undefined ? undefined : EVENTS.get(raw.hook_event_name);
  if (event === undefined) return undefined;
  const cwd = typeof raw.cwd === "string" && raw.cwd !== "" ? raw.cwd : process.cwd();
  const tool = event === "PostToolUse" || event === "PreToolUse" ? raw.tool_name : undefined;
  const input = raw.tool_input;
  current = {
    host: HOST,
    event,
    files: filesOf(event, writtenFiles(tool, input, cwd, raw.tool_response)),
    ...(SHELLS.has(tool) && typeof input?.command === "string" ? { command: input.command } : {}),
    stopActive: raw.stop_hook_active === true,
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd,
    raw,
  };
  return current;
}

function print(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function hasPerson(person) {
  return typeof person === "string" && person !== "";
}

/** Asks the model to go on before the turn ends, with `text` as what it must do, and shows the
 * person `person` where the host allows it. Asks once: a turn end that is already a continuation
 * is never continued again. */
function continueTurn(text, person) {
  if (typeof text !== "string" || text === "" || current?.stopActive === true) return;
  print({
    decision: "block",
    reason: text,
    ...(hasPerson(person) ? { systemMessage: person } : {}),
  });
}

/** Shows the person `person` alone, as the host's warning, and tells the model nothing. */
function showPerson(person) {
  if (hasPerson(person)) print({ systemMessage: person });
}

/** Level 1 informs the model, level 2 requires a fix after a write. At Stop, any answer
 * continues the turn: there is no other way to reach the model there. With no `text`, only
 * `person` is shown, at any event. */
function answer({ level, text, person } = {}) {
  if (current === undefined) return;
  if (typeof text !== "string" || text === "") return showPerson(person);
  if (current.event === "Stop") return continueTurn(text, person);
  if (level === 2 && current.event === "PostToolUse") {
    return print({ decision: "block", reason: text });
  }
  print({ hookSpecificOutput: { hookEventName: current.event, additionalContext: text } });
}

/** Refuses the tool call about to run, with `reason` as what the model is told. Does nothing at any
 * other event: a hook that refuses is written once and is harmless where nothing can be refused. */
function refuse(reason) {
  if (current?.event !== "PreToolUse" || typeof reason !== "string" || reason === "") return;
  denyToolCall(reason);
}

function denyToolCall(reason) {
  print({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
}

/** Whether `folder` is a folder of this user's alone, created when `create` and missing; its parent must exist. */
function ownFolder(folder, create) {
  if (create) {
    try {
      fs.mkdirSync(folder, { mode: 0o700 });
    } catch (error) {
      if (error.code !== "EEXIST") return false;
    }
  }
  try {
    const stat = fs.lstatSync(folder);
    if (!stat.isDirectory()) return false;
    return (
      typeof process.getuid !== "function" ||
      (stat.uid === process.getuid() && (stat.mode & 0o077) === 0)
    );
  } catch {
    return false;
  }
}

/** `<tmpdir>/aidd-hooks-<uid>/<name>` when it and the hooks folder above it are this user's alone, else null. */
function hooksFolder(name, create) {
  const hooks = path.join(
    os.tmpdir(),
    typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks"
  );
  const own = path.join(hooks, name);
  return ownFolder(hooks, create) && ownFolder(own, create) ? own : null;
}

module.exports = { readEvent, answer, continueTurn, refuse, ownFolder, hooksFolder };
