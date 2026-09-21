#!/usr/bin/env node

/**
 * The two architecture rules of issue #250, at commit time. The write-time hook only ever sees
 * Claude Code; this sees every edit that reaches a commit, whichever tool or person made it.
 *
 * Paths given as arguments are checked; with none, the whole governed tree is. `--root <dir>`
 * moves both, which is what lets the failing path be exercised against a tree that is not this
 * repository — a gate whose refusal nothing tests is a gate nobody can trust.
 */

"use strict";

const path = require("node:path");

const { describeFix, governedPaths, scan } = require("./lib/architecture-scan.js");

const DEFAULT_ROOT = path.resolve(__dirname, "..");

function parse(argv) {
  const at = argv.indexOf("--root");
  if (at === -1) return { root: DEFAULT_ROOT, requested: argv.filter((a) => !a.startsWith("-")) };

  const root = path.resolve(argv[at + 1] ?? ".");
  const rest = [...argv.slice(0, at), ...argv.slice(at + 2)];
  return { root, requested: rest.filter((a) => !a.startsWith("-")) };
}

function main(argv) {
  const { root, requested } = parse(argv);
  const relative = (argument) =>
    path.relative(root, path.resolve(root, argument)).split(path.sep).join("/");
  const paths = requested.length > 0 ? requested.map(relative) : governedPaths(root);
  const violations = scan(root, paths);

  if (violations.length === 0) {
    console.log(`✅ Architecture rules: ${paths.length} governed file(s) checked, no violation`);
    return 0;
  }

  for (const violation of violations) {
    console.error(`❌ ${violation.message}`);
    console.error(`   Fix: ${describeFix(violation)}.`);
  }
  console.error(`\n${violations.length} violation(s) across ${paths.length} checked file(s).`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
