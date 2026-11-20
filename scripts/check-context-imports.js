#!/usr/bin/env node
/**
 * Fails when an `@import` sits inside an HTML block, where a context loader skips it: the
 * file looks correct, loads nothing, and nothing reports it. A block opens on any line
 * starting with `<` and runs to the next blank line — stricter than CommonMark, because
 * not every context loader is a CommonMark parser.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const core = require("./check/contracts/custom/context-imports.cjs");

const { findHiddenImports } = core;
const collectContextFiles = () => core.collectContextFiles(ROOT);

function checkFiles(files) {
  const problems = [];
  for (const file of files) {
    for (const hidden of findHiddenImports(fs.readFileSync(file, "utf8"))) {
      problems.push({ file, ...hidden });
    }
  }
  return problems;
}

function reportProblems(problems, logger = console.error, successLogger = console.log) {
  if (problems.length === 0) {
    successLogger("✅ context imports load: none sit inside an HTML block");
    return;
  }
  logger(`❌ ${problems.length} import(s) never load: inside an HTML block`);
  for (const problem of problems) {
    const where = `${path.relative(ROOT, problem.file)}:${problem.line}`;
    logger(`  ${where}  ${problem.import}`);
    logger(`    inside the block opened line ${problem.openedBy.line} by ${problem.openedBy.text}`);
  }
  logger("  Add a blank line after the opening line, or move the imports out of the block.");
}

function runCli(argv = process.argv.slice(2), logger = console.error) {
  if (argv.length === 0) {
    const problems = checkFiles(collectContextFiles());
    reportProblems(problems);
    return problems.length === 0 ? 0 : 1;
  }

  // A path given explicitly and not read is an error. Skipping it would turn the
  // check into a green no-op, which is the failure it exists to catch.
  const files = argv.map((f) => path.resolve(ROOT, f));
  const missing = files.filter((f) => !fs.existsSync(f) || !fs.statSync(f).isFile());
  if (missing.length > 0) {
    for (const f of missing) logger(`❌ Not a readable file: ${path.relative(ROOT, f)}`);
    return 1;
  }

  const problems = checkFiles(files);
  reportProblems(problems);
  return problems.length === 0 ? 0 : 1;
}

module.exports = { findHiddenImports, checkFiles, reportProblems, collectContextFiles, runCli };

if (require.main === module) process.exit(runCli());
