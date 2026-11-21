#!/usr/bin/env node
/**
 * Fails when a tracked text file holds a path from somebody's machine: a home directory, a
 * Claude scratchpad, a macOS temp folder. Such a path names its owner and their layout, means
 * nothing on any other machine, and once pushed it stays in history for good.
 *
 * Patterns, not the current account: a check keyed to one username passes for everyone else.
 * A bare username outside a path, or a path shape not listed below, is out of its reach. Line by
 * line: multi-line structures are not parsed, nor is an array of ids, even on one line.
 *
 *   node scripts/check-no-local-paths.js <file…>   the files handed over (pre-commit)
 *   node scripts/check-no-local-paths.js --all     every tracked file (CI)
 */

const fs = require("node:fs");
const path = require("node:path");

const { findLocalPaths, isBinary, trackedFiles } = require("./check/contracts/custom/no-local-paths.cjs");

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
