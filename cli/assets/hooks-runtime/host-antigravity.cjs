"use strict";
/**
 * Antigravity CLI's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 *
 * `agy` names no event in its payload: the wrapper the build puts around each command hands it
 * over in `AIDD_HOOK_EVENT`. A payload naming no tool call, from a command without it, is read
 * as SessionStart.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOST = "antigravity";
// PreToolUse stays unmapped: no framework script acts before a tool, and the wrapper allows it.
const EVENTS = new Set(["SessionStart", "PostToolUse", "Stop"]);
// `agy` names its tools in snake case, and their arguments in Pascal case.
const WRITES = new Set(["write_file"]);
const SHELLS = new Set(["run_command"]);

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

/** The session's folder is the first workspace path: `agy` runs a hook from its `.agents`. */
function folderOf(raw) {
  const [root] = Array.isArray(raw.workspacePaths) ? raw.workspacePaths : [];
  return typeof root === "string" && root !== "" ? root : process.cwd();
}

function writtenFiles(tool, args, cwd) {
  if (!WRITES.has(tool) || typeof args?.Path !== "string") return [];
  const file = { path: path.resolve(cwd, args.Path) };
  if (typeof args.Content === "string") file.content = file.written = args.Content;
  return [file];
}

/** One empty file per conversation says its last turn end was continued. `agy` flags no
 * continuation in its payload, so the Stop that follows one finds it, and removes it. */
function markerOf(sessionId) {
  return path.join(os.tmpdir(), `aidd-agy-stop-${sessionId}`);
}

function consumeMarker(sessionId) {
  try {
    fs.unlinkSync(markerOf(sessionId));
    return true;
  } catch {
    return false;
  }
}

function eventOf(raw) {
  const named = process.env.AIDD_HOOK_EVENT;
  if (named !== undefined) return EVENTS.has(named) ? named : undefined;
  return raw.toolCall === undefined ? "SessionStart" : undefined;
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  if (raw === undefined || typeof raw !== "object") return undefined;
  const event = eventOf(raw);
  if (event === undefined || typeof raw.conversationId !== "string") return undefined;
  const cwd = folderOf(raw);
  const tool = event === "PostToolUse" ? raw.toolCall?.name : undefined;
  const args = raw.toolCall?.args;
  current = {
    host: HOST,
    event,
    files: writtenFiles(tool, args, cwd),
    ...(SHELLS.has(tool) && typeof args?.CommandLine === "string"
      ? { command: args.CommandLine }
      : {}),
    stopActive: event === "Stop" && consumeMarker(raw.conversationId),
    sessionId: raw.conversationId,
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
  if (typeof text !== "string" || text === "" || current?.event !== "Stop") return;
  if (current.stopActive) return;
  try {
    fs.writeFileSync(markerOf(current.sessionId), "");
  } catch {
    // Without its marker the next Stop would continue again, forever: so it continues nothing.
    return;
  }
  print({ decision: "continue", reason: text });
}

// `agy` takes no context from a SessionStart or a PostToolUse answer (an injection goes through
// PostInvocation, which is not relayed), so only a Stop answers.
function answer({ text } = {}) {
  if (current?.event === "Stop") continueTurn(text);
}

module.exports = { readEvent, answer, continueTurn };
