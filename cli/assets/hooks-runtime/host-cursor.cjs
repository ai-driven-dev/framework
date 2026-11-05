"use strict";
/**
 * Cursor's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "cursor";
// `sessionEnd` is left out: the session is over, so nothing is left to continue.
const EVENTS = new Map([
  ["sessionStart", "SessionStart"],
  ["postToolUse", "PostToolUse"],
  ["stop", "Stop"],
]);
const WRITES = new Set(["Write", "Edit", "MultiEdit"]);
const SHELLS = new Set(["Shell"]);

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

/** A shell call carries `cwd`, empty when it ran in the workspace; no other call does. */
function folderOf(raw) {
  if (typeof raw.cwd === "string" && raw.cwd !== "") return raw.cwd;
  const [root] = Array.isArray(raw.workspace_roots) ? raw.workspace_roots : [];
  return typeof root === "string" && root !== "" ? root : process.cwd();
}

function writtenFiles(tool, input, cwd) {
  if (!WRITES.has(tool) || typeof input?.file_path !== "string") return [];
  const file = { path: path.resolve(cwd, input.file_path) };
  // A write carries the whole file; an edit carries fragments of it, never `content`.
  if (typeof input.content === "string") file.content = input.content;
  return [file];
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  const event = raw === undefined ? undefined : EVENTS.get(raw.hook_event_name);
  if (event === undefined) return undefined;
  const cwd = folderOf(raw);
  const tool = event === "PostToolUse" ? raw.tool_name : undefined;
  const input = raw.tool_input;
  current = {
    host: HOST,
    event,
    files: writtenFiles(tool, input, cwd),
    ...(SHELLS.has(tool) && typeof input?.command === "string" ? { command: input.command } : {}),
    // Cursor counts the follow-ups it already ran for this turn.
    stopActive: Number(raw.loop_count) > 0,
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd,
    raw,
  };
  return current;
}

function print(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

/** Asks the model to go on before the turn ends, with `text` as what it must do. */
function continueTurn(text) {
  if (typeof text !== "string" || text === "") return;
  print({ followup_message: text });
}

/** Both levels inform: Cursor was seen dropping a block after a write, so the model would
 * see nothing. At stop, any answer continues the turn. */
function answer({ text } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  if (current.event === "Stop") return continueTurn(text);
  print({ additional_context: text });
}

module.exports = { readEvent, answer, continueTurn };
