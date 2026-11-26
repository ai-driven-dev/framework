"use strict";
/**
 * Antigravity CLI's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 * `agy` takes context from SessionStart, PreInvocation and PostInvocation, never from PostToolUse:
 * a level 2 PostToolUse answer is held, and released at the next model call by this file run as the
 * PreInvocation hook's command.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "antigravity";
const EVENTS = new Set(["SessionStart", "PreToolUse", "PostToolUse", "Stop"]);
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

/** The session's folder is the first workspace path: `agy` runs a hook from its plugin's root. */
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

/** Before a tool runs nothing is written yet: only where it is about to write is known, so a file
 * carries its path and no text. */
function filesOf(event, files) {
  return event === "PreToolUse" ? files.map(({ path }) => ({ path })) : files;
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  if (raw === undefined || typeof raw !== "object") return undefined;
  const event = EVENTS.has(raw.hookEventName) ? raw.hookEventName : undefined;
  if (event === undefined || typeof raw.conversationId !== "string") return undefined;
  const cwd = folderOf(raw);
  const tool = event === "PostToolUse" || event === "PreToolUse" ? raw.toolCall?.name : undefined;
  const args = raw.toolCall?.args;
  current = {
    host: HOST,
    event,
    files: filesOf(event, writtenFiles(tool, args, cwd)),
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

/** What `agy` hands the model as a system message, one step per text. */
function injected(texts) {
  return { injectSteps: texts.map((text) => ({ systemMessage: { systemMessage: text } })) };
}

const os = require("node:os");

const OTHERS_BITS = 0o077;

/** The folder the user's hooks keep their hand-offs in, `<tmpdir>/aidd-hooks-<uid>`: made when
 * `create`, and null unless it is this user's alone. */
function ownFolder(create) {
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const folder = path.join(os.tmpdir(), uid === undefined ? "aidd-hooks" : `aidd-hooks-${uid}`);
  try {
    if (create) fs.mkdirSync(folder, { mode: 0o700, recursive: true });
    const stat = fs.lstatSync(folder);
    const own = uid === undefined || (stat.uid === uid && (stat.mode & OTHERS_BITS) === 0);
    return own ? folder : null;
  } catch {
    return null;
  }
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const HELD_PREFIX = "held-answer-";

/** Where the texts held for a conversation wait, or null when there is no safe place. */
function heldFile(conversationId, create) {
  const folder = SAFE_ID.test(conversationId) ? ownFolder(create) : null;
  return folder === null ? null : path.join(folder, `${HELD_PREFIX}${conversationId}`);
}

/** Holds `text` for the session's next model call, one JSON line per text. A session ended before
 * that call leaves its file in the temp directory. */
function hold(text) {
  try {
    const file = heldFile(current.sessionId, true);
    if (file === null) return;
    fs.appendFileSync(file, `${JSON.stringify(text)}\n`, { mode: 0o600 });
  } catch {}
}

/** The texts held for a conversation, in the order held, which are held no more. The file is
 * renamed before it is read, so of several hooks running together exactly one finds it. */
function takeHeld(conversationId) {
  const file = heldFile(conversationId, false);
  if (file === null) return [];
  const claimed = `${file}.${process.pid}`;
  try {
    fs.renameSync(file, claimed);
  } catch {
    return [];
  }
  try {
    return fs.readFileSync(claimed, "utf8").split("\n").filter(Boolean).map(JSON.parse);
  } catch {
    return [];
  } finally {
    fs.rmSync(claimed, { force: true });
  }
}

/** Prints what was held for the conversation of the PreInvocation on stdin. */
function release() {
  const texts = takeHeld(readPayload()?.conversationId);
  if (texts.length > 0) print(injected(texts));
}

/** A Stop answer continues the turn. A SessionStart answer is an injected system message, which
 * `agy` hands the model before its first call. A PostToolUse answer is held when it requires
 * something (level 2), for `release`; one that only informs is dropped. */
function answer({ level, text } = {}) {
  if (typeof text !== "string" || text === "") return;
  if (current?.event === "Stop") return continueTurn(text);
  if (current?.event === "PostToolUse" && level === 2) return hold(text);
  if (current?.event === "SessionStart") print(injected([text]));
}

/** Refuses the tool call about to run, with `reason` as what the model is told. Does nothing at any
 * other event: a hook that refuses is written once and is harmless where nothing can be refused.
 * `agy` runs the tool on `allow` and on no answer, and denies on an empty object, so only an
 * explicit deny refuses. */
function refuse(reason) {
  if (current?.event !== "PreToolUse" || typeof reason !== "string" || reason === "") return;
  print({ decision: "deny", reason });
}

module.exports = { readEvent, answer, continueTurn, refuse, release };

if (require.main === module) release();
