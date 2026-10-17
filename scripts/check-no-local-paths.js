#!/usr/bin/env node
/**
 * Fails when a tracked text file holds a path from somebody's machine: a home directory, a
 * Claude scratchpad, a macOS temp folder. Such a path names its owner and their layout, means
 * nothing on any other machine, and once pushed it stays in history for good.
 *
 * Patterns, not the current account: a check keyed to one username passes for everyone else.
 *
 *   node scripts/check-no-local-paths.js <file…>   the files handed over (pre-commit)
 *   node scripts/check-no-local-paths.js --all     every tracked file (CI)
 */

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Account names that are placeholders in tests and examples, never a person: the generic ones
 * (user, u, a, me, dev, someone, alice) and the GitHub Actions accounts, `runner` and Windows'
 * `runneradmin`, whose home also appears in its 8.3 short form (`RUNNER~1`). Each one was found
 * on the tree.
 */
const PLACEHOLDER_NAMES = new Set([
  "user",
  "u",
  "a",
  "me",
  "dev",
  "someone",
  "alice",
  "runner",
  "runneradmin",
]);

/** An account name: alphanumeric first, so `/home/.claude/` (a fake HOME) is no account. */
const NAME = String.raw`([A-Za-z0-9][\w.~-]*)`;
/** At the root of a path only: `/proj/home/x/` is a project folder, not a home. */
const ROOTED = String.raw`(?<![\w.-])`;

const PATTERNS = [
  { label: "/Users/<name>/", re: new RegExp(`${ROOTED}/Users/${NAME}/`, "giu"), named: true },
  { label: "/home/<name>/", re: new RegExp(`${ROOTED}/home/${NAME}/`, "giu"), named: true },
  // One or more backslashes: the raw path, and the same path escaped in JSON or a JS string.
  {
    label: "C:\\Users\\<name>\\",
    re: new RegExp(String.raw`${ROOTED}[A-Za-z]:\\+Users\\+${NAME}\\+`, "giu"),
    named: true,
  },
  { label: "/private/tmp/claude-<uid>/", re: /(?:\/private)?\/tmp\/claude-\d+\//gu, named: false },
  // Joined, not written out: this file is tracked too, and must pass its own check.
  { label: ["", "var", "folders", ""].join("/"), re: /\/var\/folders\//gu, named: false },
];

function isPlaceholder(name) {
  return PLACEHOLDER_NAMES.has(name.toLowerCase().replace(/~\d+$/u, ""));
}

/** Every leak in a text, as its 1-based line and the pattern it matched: never the match. */
function findLocalPaths(text) {
  const found = [];

  text.split(/\r?\n/u).forEach((content, index) => {
    for (const { label, re, named } of PATTERNS) {
      for (const match of content.matchAll(re)) {
        if (named && isPlaceholder(match[1])) continue;
        found.push({ line: index + 1, label });
      }
    }
  });

  return found;
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
    const absolute = path.resolve(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const buffer = fs.readFileSync(absolute);
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

module.exports = { PLACEHOLDER_NAMES, findLocalPaths, run };

if (require.main === module) {
  process.exit(run());
}
