"use strict";
/**
 * Kiro's side of the one interface every framework hook speaks: `readEvent()` turns the host's
 * stdin into a neutral event, `answer()` and `continueTurn()` print the host's own answer. The
 * build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree ships Claude
 * Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 *
 * Limit: a payload naming an event no script reads (UserPromptSubmit, SubagentStop) is no event.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOST = "kiro";
const EVENTS = new Set(["SessionStart", "PreToolUse", "PostToolUse", "Stop"]);
/** The write tools a capture shows: `fs_write` takes `{ path, text }`, `str_replace` takes
 * `{ path, oldStr, newStr, replace_all }`. */
const WRITES = new Set(["fs_write", "str_replace"]);
/** The shell tool a capture shows: its input is `{ command, description, cwd, ... }`. */
const SHELLS = new Set(["execute_bash"]);

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

function writtenFiles(tool, input, cwd) {
  if (!WRITES.has(tool) || typeof input?.path !== "string") return [];
  const file = { path: path.resolve(cwd, input.path) };
  if (typeof input.text === "string") file.written = input.text;
  if (typeof input.newStr === "string") file.written = input.newStr;
  if (typeof input.oldStr === "string") file.replaced = input.oldStr;
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
  if (raw === undefined || !EVENTS.has(raw.hook_event_name)) return undefined;
  const event = raw.hook_event_name;
  const cwd = typeof raw.cwd === "string" && raw.cwd !== "" ? raw.cwd : process.cwd();
  current = {
    host: HOST,
    event,
    files: filesOf(event, writtenFiles(raw.tool_name, raw.tool_input, cwd)),
    ...(SHELLS.has(raw.tool_name) && typeof raw.tool_input?.command === "string"
      ? { command: raw.tool_input.command }
      : {}),
    stopActive: false, // Kiro payloads carry no continuation marker
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd,
    raw,
  };
  return current;
}

function print(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

// A block decision at Stop: https://kiro.dev/docs/hooks/types/ (CLI tab)
/** Asks the model to go on before the turn ends, with `text` as what it must do. Asks once: a
 * turn end that is already a continuation is never continued again. */
function continueTurn(text) {
  if (current?.event !== "Stop" || typeof text !== "string" || text === "") return;
  if (current.stopActive === true) return;
  print({ decision: "block", reason: text });
}

/** A SessionStart hook's standard output is added to the agent's context as printed
 * (https://kiro.dev/docs/hooks/types/), so the text goes out bare. At Stop, any answer continues
 * the turn. Output after a tool call was never seen reaching the model, so none is printed. */
function answer({ text } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  if (current.event === "Stop") return continueTurn(text);
  if (current.event === "SessionStart") process.stdout.write(`${text}\n`);
}

/** Refuses the tool call about to run, with `reason` as what the model is told. Does nothing at any
 * other event: a hook that refuses is written once and is harmless where nothing can be refused. */
function refuse(reason) {
  if (current?.event !== "PreToolUse" || typeof reason !== "string" || reason === "") return;
  denyToolCall(reason);
}

/** Exit code 2 with the reason on standard error. */
function denyToolCall(reason) {
  process.stderr.write(reason);
  process.exitCode = 2;
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
