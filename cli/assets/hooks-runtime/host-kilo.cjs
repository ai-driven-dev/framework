"use strict";
/**
 * Kilo's side of the one interface every framework hook speaks: `readEvent()` turns
 * what the Kilo bridge sends on stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "kilo";
const EVENTS = new Map([
  ["SessionStart", "SessionStart"],
  ["PostToolUse", "PostToolUse"],
  ["Stop", "Stop"],
]);
// The host names its tools in lowercase.
const WRITES = new Set(["write", "edit"]);
const SHELLS = new Set(["bash"]);

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
  if (!WRITES.has(tool) || typeof input?.filePath !== "string") return [];
  const file = { path: path.resolve(cwd, input.filePath) };
  // A write carries the whole file; an edit carries fragments of it, never `content`.
  if (typeof input.content === "string") file.content = input.content;
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
    files: writtenFiles(tool, input, cwd),
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

/** Asks the model to go on before the turn ends, with `text` as what it must do. Asks once: a
 * turn end that is already a continuation is never continued again. */
function continueTurn(text) {
  if (typeof text !== "string" || text === "" || current?.stopActive === true) return;
  print({ decision: "block", reason: text });
}

/** Both levels inform: the bridge appends the text to the tool's result, which is all a
 * block would do there. At Stop, any answer continues the turn. */
function answer({ text } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  if (current.event === "Stop") return continueTurn(text);
  print({ additionalContext: text });
}

module.exports = { readEvent, answer, continueTurn };
