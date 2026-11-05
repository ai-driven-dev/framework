"use strict";
/**
 * Copilot's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "copilot";
const EVENTS = new Map([
  ["SessionStart", "SessionStart"],
  ["PostToolUse", "PostToolUse"],
  ["Stop", "Stop"],
]);
const SHELLS = new Set(["Bash"]);
const PATCH_FILE = /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/gm;

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Every file a patch names, once each, in the order it names them: added, updated, moved
 * to, or deleted. */
function patchedFiles(patch, cwd) {
  const paths = new Set();
  for (const [, named] of patch.matchAll(PATCH_FILE)) paths.add(path.resolve(cwd, named.trim()));
  return [...paths].map((file) => ({ path: file }));
}

/** A file write arrives as an `Edit` whose whole `tool_input` is the patch text; every other
 * tool's input is an object. */
function writtenFiles(_tool, input, cwd) {
  return typeof input === "string" ? patchedFiles(input, cwd) : [];
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

/** Level 1 informs the model, level 2 requires a fix after a write. At Stop, any answer
 * continues the turn: there is no other way to reach the model there. */
function answer({ level, text } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  if (current.event === "Stop") return continueTurn(text);
  if (level === 2 && current.event === "PostToolUse") {
    return print({ decision: "block", reason: text });
  }
  print({ additionalContext: text });
}

module.exports = { readEvent, answer, continueTurn };
