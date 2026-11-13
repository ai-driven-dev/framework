"use strict";
/**
 * Claude Code's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; this one ships in
 * the plugin tree. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "claude";
const EVENTS = new Map([
  ["SessionStart", "SessionStart"],
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

function writtenFiles(tool, input, response, cwd) {
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

function readEvent() {
  current = undefined;
  const raw = readPayload();
  const event = raw === undefined ? undefined : EVENTS.get(raw.hook_event_name);
  if (event === undefined) return undefined;
  const cwd = typeof raw.cwd === "string" && raw.cwd !== "" ? raw.cwd : process.cwd();
  const tool = event === "PostToolUse" ? raw.tool_name : undefined;
  const input = raw.tool_input;
  current = {
    host: HOST,
    event,
    files: writtenFiles(tool, input, raw.tool_response, cwd),
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

/** Asks the model to go on before the turn ends, with `text` as what it must do, and shows the
 * person `person` where the host allows it. Asks once: a turn end that is already a continuation
 * is never continued again. */
function continueTurn(text, person) {
  if (typeof text !== "string" || text === "" || current?.stopActive === true) return;
  print({
    decision: "block",
    reason: text,
    ...(typeof person === "string" && person !== "" ? { systemMessage: person } : {}),
  });
}

/** Level 1 informs the model, level 2 requires a fix after a write. At Stop, any answer
 * continues the turn: there is no other way to reach the model there. */
function answer({ level, text, person } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  if (current.event === "Stop") return continueTurn(text, person);
  if (level === 2 && current.event === "PostToolUse") {
    return print({ decision: "block", reason: text });
  }
  print({ hookSpecificOutput: { hookEventName: current.event, additionalContext: text } });
}

module.exports = { readEvent, answer, continueTurn };
