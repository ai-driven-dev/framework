#!/usr/bin/env node
/**
 * Fails when this repository's own prose names a path that does not exist. The link checker
 * resolves markdown links; nothing resolved a path written in backticks.
 *
 * A reference is anchored on a real top-level entry rather than on "looks like a path":
 * widening it to any `a/b` token reports MIME types, context-relative fragments and shell
 * fragments, and a gate nobody trusts is a gate nobody reads.
 *
 * Always whole-tree — the hook's glob decides only whether this runs, never what it reads —
 * because a path dies when the file it names is deleted, in a commit that touches no page.
 * `cli/` carries its own ratchet (cli/tests/architecture/referenced-paths.arch.test.ts).
 */

const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const core = require("./check/contracts/custom/referenced-paths.cjs");

const topLevelEntries = () => core.topLevelEntries(ROOT);
const referencedPaths = (content, entries = topLevelEntries()) => core.referencedPaths(content, entries);
const deadReferences = (files) => core.deadReferences(ROOT, files);
const scannedFiles = () => core.scannedFiles(ROOT);

function scanRepository() {
  const files = scannedFiles();
  return { scannedFiles: files.length, dead: deadReferences(files) };
}

function run(logger = console.error, successLogger = console.log) {
  const { scannedFiles: count, dead } = scanRepository();

  if (dead.length === 0) {
    successLogger(`✅ Referenced paths: 0 dead in ${count} files`);
    return 0;
  }

  logger(`❌ ${dead.length} referenced path(s) naming nothing on disk`);
  for (const { file, line, target } of dead) {
    logger(`  ${path.relative(ROOT, file)}:${line}  ${target}`);
  }
  return 1;
}

module.exports = { deadReferences, referencedPaths, scanRepository, run };

if (require.main === module) {
  process.exit(run());
}
