"use strict";
/**
 * Antigravity CLI's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "antigravity";
// PreToolUse stays unmapped: no framework script acts before a tool.
const EVENTS = new Set(["SessionStart", "PostToolUse", "Stop"]);
// `agy` names its tools in snake case, and their arguments in Pascal case.
const WRITES = new Set(["write_file"]);
// An edit names the text it replaces and the text that replaces it, never the whole file.
const EDITS = new Set(["edit_file"]);
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
  if (typeof args?.Path !== "string") return [];
  const file = { path: path.resolve(cwd, args.Path) };
  if (EDITS.has(tool)) {
    if (typeof args.Replacement === "string") file.written = args.Replacement;
    if (typeof args.Target === "string") file.replaced = args.Target;
    return [file];
  }
  if (!WRITES.has(tool)) return [];
  if (typeof args.Content === "string") file.content = file.written = args.Content;
  return [file];
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  if (raw === undefined || typeof raw !== "object") return undefined;
  const event = EVENTS.has(raw.hookEventName) ? raw.hookEventName : undefined;
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
    // `executionNum` is 0 on a turn's first Stop and counts up after each continuation.
    stopActive: event === "Stop" && typeof raw.executionNum === "number" && raw.executionNum > 0,
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
  print({ decision: "continue", reason: text });
}

/** A Stop answer continues the turn. A SessionStart answer is an injected system message, which
 * `agy` hands the model before its first call. A PostToolUse answer is never carried: `agy` takes
 * no context from it. */
function answer({ text } = {}) {
  if (current?.event === "Stop") return continueTurn(text);
  if (current?.event !== "SessionStart" || typeof text !== "string" || text === "") return;
  print({ injectSteps: [{ systemMessage: { systemMessage: text } }] });
}

module.exports = { readEvent, answer, continueTurn };
