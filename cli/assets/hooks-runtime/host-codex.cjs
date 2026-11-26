"use strict";
/**
 * Codex's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "codex";
const EVENTS = new Map([
  ["SessionStart", "SessionStart"],
  ["PreToolUse", "PreToolUse"],
  ["PostToolUse", "PostToolUse"],
  ["Stop", "Stop"],
]);
const SHELLS = new Set(["Bash"]);

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

const PATCH_FILE = /^\*\*\* (Add File|Update File|Delete File|Move to): (.+)$/;

/** Every file a patch names, once each, in the order it names them, with the lines the patch
 * added to it and those it removed as what it replaced, empty when none: an added or updated file,
 * or a move's new path. A deleted file and a move's source carry none. */
function patchedFiles(patch, cwd) {
  const files = new Map();
  let target;
  // CRLF patches too: a carriage return left on a line would hide a header and end every path.
  for (const line of patch.split(/\r?\n/)) {
    const header = PATCH_FILE.exec(line);
    if (header !== null) {
      const [, kind, named] = header;
      const file = path.resolve(cwd, named.trim());
      const source = files.get(target);
      if (kind === "Move to" && source?.added.length === 0 && source.removed.length === 0) {
        files.set(target, undefined);
      }
      const fresh = { added: [], removed: [] };
      files.set(file, kind === "Delete File" ? files.get(file) : (files.get(file) ?? fresh));
      target = file;
    } else if (line.startsWith("+")) {
      files.get(target)?.added.push(line.slice(1));
    } else if (line.startsWith("-")) {
      files.get(target)?.removed.push(line.slice(1));
    }
  }
  return [...files].map(([file, lines]) => {
    if (lines === undefined) return { path: file };
    return { path: file, written: lines.added.join("\n"), replaced: lines.removed.join("\n") };
  });
}

/** A file write arrives as an `apply_patch`, its patch in `tool_input.command`. */
function writtenFiles(_tool, input, cwd) {
  return typeof input?.command === "string" ? patchedFiles(input.command, cwd) : [];
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
    files: filesOf(event, writtenFiles(tool, input, cwd)),
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

/** Whether there is a message to show the person. */
function hasPerson(person) {
  return typeof person === "string" && person !== "";
}

/** Shows the person `person` alone, as the host's warning, and tells the model nothing. */
function showPerson(person) {
  if (hasPerson(person)) print({ systemMessage: person });
}

/** Level 1 informs the model, level 2 requires a fix after a write. At Stop, any answer
 * continues the turn: there is no other way to reach the model there. With no `text`, only
 * `person` is shown, at any event; beside a `text`, it is ignored. */
function answer({ level, text, person } = {}) {
  if (current === undefined) return;
  if (typeof text !== "string" || text === "") return showPerson(person);
  if (current.event === "Stop") return continueTurn(text);
  if (level === 2 && current.event === "PostToolUse") {
    return print({ decision: "block", reason: text });
  }
  print({ hookSpecificOutput: { hookEventName: current.event, additionalContext: text } });
}

/** Refuses the tool call about to run, with `reason` as what the model is told. Does nothing at any
 * other event: a hook that refuses is written once and is harmless where nothing can be refused. */
function refuse(reason) {
  if (current?.event !== "PreToolUse" || typeof reason !== "string" || reason === "") return;
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

module.exports = { readEvent, answer, continueTurn, refuse, ownFolder };
