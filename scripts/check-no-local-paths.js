#!/usr/bin/env node
/**
 * Fails when a tracked text file holds a path from somebody's machine: a home directory, a
 * Claude scratchpad, a macOS temp folder. Such a path names its owner and their layout, means
 * nothing on any other machine, and once pushed it stays in history for good.
 *
 * Patterns, not the current account: a check keyed to one username passes for everyone else.
 * A bare username outside a path, or a path shape not listed below, is out of its reach.
 *
 *   node scripts/check-no-local-paths.js <file…>   the files handed over (pre-commit)
 *   node scripts/check-no-local-paths.js --all     every tracked file (CI)
 */

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Account names that are placeholders in tests and examples, never a person. Each one is
 * matched on the tree, in a test or a task document:
 * - generic stand-ins: user, u, a, me, dev, someone, alice, tester, test, p;
 * - `aidd`, the product's own name used as a fake account;
 * - `jane` and `first`, the first word of `Jane Doe` and `First Last`, homes with a space;
 * - the GitHub Actions accounts `runner` and Windows' `runneradmin`, the former also in its 8.3
 *   short form (`RUNNER~1`).
 */
const PLACEHOLDER_NAMES = new Set([
  "user",
  "u",
  "a",
  "me",
  "dev",
  "someone",
  "alice",
  "tester",
  "test",
  "p",
  "aidd",
  "jane",
  "first",
  "runner",
  "runneradmin",
]);

/** An account name: alphanumeric first, so `/home/.claude/` (a fake HOME) is no account. */
const NAME = String.raw`([A-Za-z0-9][\w.~-]*)`;
/** Where a name ends: a separator, a quote, a space or punctuation, so a bare home counts. */
const NAME_END = String.raw`(?=[/\\"'\x60\s),;:]|$)`;
/** At the root of a path only: `/proj/home/x/` is a project folder, not a home. */
const ROOTED = String.raw`(?<![\w.-])`;
const UUID = String.raw`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`;
/** A JSON key naming a session or a Codex thread, its quotes optionally escaped. */
const SESSION_KEY = String.raw`\\?"(?:session|session_id|sessionId|thread_id|threadId|threadIds)\\?"\s*:\s*`;

const PATTERNS = [
  { label: "/Users/<name>", re: new RegExp(`${ROOTED}/Users/${NAME}${NAME_END}`, "giu"), named: true },
  { label: "/home/<name>", re: new RegExp(`${ROOTED}/home/${NAME}${NAME_END}`, "giu"), named: true },
  // One or more backslashes: the raw path, and the same path escaped in JSON or a JS string.
  {
    label: "C:\\Users\\<name>",
    re: new RegExp(String.raw`${ROOTED}[A-Za-z]:\\+Users\\+${NAME}${NAME_END}`, "giu"),
    named: true,
  },
  // A home folded into one directory name, as Claude Code names its projects (`C--Users-…` on
  // Windows). No dash in the name: the dash is where the next folder starts.
  {
    label: "-Users-<name>-",
    re: /(?<![\w.-])(?:[A-Za-z]-)?-(?:Users|home)-([A-Za-z0-9][A-Za-z0-9.]*)-/gu,
    named: true,
  },
  { label: "/private/tmp/claude-<uid>/", re: /(?:\/private)?\/tmp\/claude-\d+\//gu, named: false },
  // Joined, not written out: this file is tracked too, and must pass its own check.
  { label: ["", "var", "folders", ""].join("/"), re: /\/var\/folders\//gu, named: false },
  // A UUID where a key or Copilot's state folder says it is a session, escaped in JSON or not.
  // An array under such a key is read whole by SESSION_ARRAY, below.
  {
    label: "session id",
    re: new RegExp(String.raw`(?:session-state/|${SESSION_KEY}\\?")(${UUID})`, "giu"),
    session: true,
  },
  // A UUID naming a transcript: Claude's `<project>/<id>.jsonl`, Codex's `rollout-<time>-<id>.jsonl`.
  {
    label: "session file",
    re: new RegExp(String.raw`(?:rollout-[\dT:-]+-|[/\\])(${UUID})\.jsonl`, "giu"),
    session: true,
  },
];

/** An array of ids under a session key, which may span lines: found on the whole text. */
const SESSION_ARRAY_OPEN = new RegExp(String.raw`${SESSION_KEY}\[`, "giu");
/**
 * How much of one array is read. An assumption, not a fact: no capture is expected to hold more
 * ids than this under one key, and an id past it is missed.
 */
const MAX_ARRAY_BODY = 64 * 1024;
const ANY_UUID = new RegExp(UUID, "giu");

function isPlaceholder(name) {
  return PLACEHOLDER_NAMES.has(name.toLowerCase().replace(/\.$/u, "").replace(/~\d+$/u, ""));
}

/** A made-up id repeats a few digits (`00000000-…-00000000000a`); a real one uses most of 16. */
function isPlaceholderId(id) {
  return new Set(id.replace(/-/gu, "").toLowerCase()).size < 8;
}

/** Every leak in a text, as its 1-based line and the pattern it matched: never the match. */
function findLocalPaths(text) {
  const found = [];

  text.split(/\r?\n/u).forEach((content, index) => {
    for (const { label, re, named, session } of PATTERNS) {
      for (const match of content.matchAll(re)) {
        if (named && isPlaceholder(match[1])) continue;
        if (session && isPlaceholderId(match[1])) continue;
        found.push({ line: index + 1, label });
      }
    }
  });

  const lineAt = lineFinder(text);
  for (const { start, body } of sessionArrays(text)) {
    for (const id of body.matchAll(ANY_UUID)) {
      if (isPlaceholderId(id[0])) continue;
      found.push({ line: lineAt(start + id.index), label: "session id" });
    }
  }

  return found.sort((a, b) => a.line - b.line);
}

/**
 * Each array under a session key, as its body and where the body starts. The search resumes past
 * each array's `]`, so a key nested inside one is read once, as part of it.
 */
function* sessionArrays(text) {
  const open = new RegExp(SESSION_ARRAY_OPEN.source, SESSION_ARRAY_OPEN.flags);
  for (let key = open.exec(text); key; key = open.exec(text)) {
    const start = key.index + key[0].length;
    const close = text.indexOf("]", start);
    // No `]` after this key means none after any later one: stop, rather than rescan per key.
    if (close === -1) return;
    yield { start, body: text.slice(start, Math.min(close, start + MAX_ARRAY_BODY)) };
    open.lastIndex = close + 1;
  }
}

/** The 1-based line of an offset, by binary search over newline offsets computed once. */
function lineFinder(text) {
  let newlines;
  return (offset) => {
    newlines ??= [...text.matchAll(/\n/gu)].map((m) => m.index);
    let low = 0;
    let high = newlines.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (newlines[mid] < offset) low = mid + 1;
      else high = mid;
    }
    return low + 1;
  };
}

/** NUL in the first 8 KiB, git's own test for binary. */
function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

function trackedFiles(root) {
  return cp
    .execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\0")
    .filter(Boolean);
}

function run(args = process.argv.slice(2), root = process.cwd(), logger = console.error) {
  const files = args.includes("--all") ? trackedFiles(root) : args.filter((a) => a !== "--");
  const leaks = [];

  for (const file of files) {
    let buffer;
    // Read, then skip on failure: checking first and reading after races the file system.
    try {
      buffer = fs.readFileSync(path.resolve(root, file));
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") continue;
      throw error;
    }
    if (isBinary(buffer)) continue;
    for (const { line, label } of findLocalPaths(buffer.toString("utf8"))) {
      leaks.push(`${file.split(path.sep).join("/")}:${line}: ${label}`);
    }
  }

  if (leaks.length === 0) {
    console.log(`✅ No local paths: 0 leak(s) in ${files.length} file(s)`);
    return 0;
  }

  logger(`❌ ${leaks.length} local machine path(s) in tracked files`);
  for (const leak of leaks) logger(`  ${leak}`);
  logger("replace each with a placeholder (<home>, <worktree>, <scratch>, <tmp>) or a relative path");
  return 1;
}

module.exports = { findLocalPaths };

if (require.main === module) {
  process.exit(run());
}
