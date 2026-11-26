"use strict";
/**
 * Kiro's side of the one interface every framework hook speaks: `readEvent()` turns the host's
 * stdin into a neutral event, `answer()` and `continueTurn()` print the host's own answer. The
 * build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree ships Claude
 * Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 *
 * SessionStart, PreToolUse, PostToolUse and Stop are delivered to Kiro: they are the events whose
 * payload was captured, so a payload naming any other event is read as no event. UserPromptSubmit
 * and SubagentStop are captured too and delivered by the profile, but no framework script reads
 * them: like Cursor's, their payloads read as no event until one does.
 */
const fs = require("node:fs");
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
    stopActive: false, // kiro-cli V3 payloads carry no continuation marker
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd,
    raw,
  };
  return current;
}

function print(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

/** Asks the model to go on before the turn ends, with `text` as what it must do: a block decision
 * at Stop, documented for the Agent Stop trigger (https://kiro.dev/docs/hooks/types/, CLI tab) and
 * seen answered on kiro-cli V3 (other Kiro surfaces unprobed). */
function continueTurn(text) {
  if (current?.event !== "Stop" || typeof text !== "string" || text === "") return;
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

// kiro-cli V3 was seen to stop the tool on it and hand the reason to the model.
/** Refuses the tool call about to run, with `reason` as what the model is told: exit code 2 with
 * the reason on standard error. Does nothing at any other event: a hook that refuses is written
 * once and is harmless where nothing can be refused. */
function refuse(reason) {
  if (current?.event !== "PreToolUse" || typeof reason !== "string" || reason === "") return;
  process.stderr.write(reason);
  process.exitCode = 2;
}

module.exports = { readEvent, answer, continueTurn, refuse };
