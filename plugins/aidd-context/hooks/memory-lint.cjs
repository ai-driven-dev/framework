#!/usr/bin/env node
/**
 * Checks a project's memory files against the bank's format rules, M1 to M7. The only file
 * here that reads the disk; the rules themselves are pure and live in the rules library beside it.
 *
 * `node memory-lint.cjs [root] [file...]` prints one line per problem and exits 1 when an error
 * remains. With no file it checks the whole bank. A project without a bank has nothing to check.
 */

const fs = require("node:fs");
const path = require("node:path");
const { ERROR, RULES } = require("./lib/memory-rules.cjs");

const MEMORY_DIR = path.join("aidd_docs", "memory");
const EXCLUDED_FILE = "README.md";
const IGNORED_ENTRY = ".git";

const ERROR_MARK = "✗";
const WARNING_MARK = "⚠";
const EXIT_OK = 0;
const EXIT_ERRORS = 1;

function toPosix(file) {
  return file.split(path.sep).join("/");
}

// Only the always-loaded files directly under the bank: `internal/` and `external/` are
// read on demand and keep their own formats.
function memoryFilesUnder(root) {
  const bank = path.join(root, MEMORY_DIR);
  if (!fs.existsSync(bank)) return [];

  return fs
    .readdirSync(bank, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== EXCLUDED_FILE)
    .map((entry) => toPosix(path.join(MEMORY_DIR, entry.name)))
    .sort();
}

function topLevelEntries(root) {
  return new Set(fs.readdirSync(root).filter((entry) => entry !== IGNORED_ENTRY));
}

function textsOf(root, files) {
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));
}

function bySeverity(a, b) {
  return Number(b.severity === ERROR) - Number(a.severity === ERROR);
}

function runRules(rules, context) {
  const found = [];

  for (const rule of rules) {
    try {
      found.push(...rule.check(context));
    } catch (error) {
      found.push({
        file: context.file,
        line: 1,
        rule: rule.id,
        severity: rule.severity,
        message: `rule ${rule.id} failed: ${error.message}`,
      });
    }
  }

  return found;
}

function lintFile(root, file, rules = RULES) {
  const relative = toPosix(path.isAbsolute(file) ? path.relative(root, file) : file);
  if (!memoryFilesUnder(root).includes(relative)) return [];
  const others = textsOf(root, memoryFilesUnder(root).filter((other) => other !== relative));

  const context = {
    file: relative,
    text: fs.readFileSync(path.join(root, relative), "utf8"),
    exists: (target) => fs.existsSync(path.resolve(root, target)),
    entries: topLevelEntries(root),
    others,
  };

  return runRules(rules, context).sort((a, b) => bySeverity(a, b) || a.line - b.line);
}

function lintBank(root) {
  const problems = memoryFilesUnder(root).flatMap((file) => lintFile(root, file));
  return problems.sort(bySeverity);
}

function format({ file, line, rule, severity, message }) {
  const mark = severity === ERROR ? ERROR_MARK : WARNING_MARK;
  return `${mark} ${file}:${line}: ${message} (${rule})`;
}

function run(args, write = (line) => process.stdout.write(`${line}\n`)) {
  const [root = process.cwd(), ...files] = args;
  const absolute = path.resolve(root);
  const problems = files.length > 0 ? files.flatMap((file) => lintFile(absolute, file)).sort(bySeverity) : lintBank(absolute);

  for (const found of problems) write(format(found));
  return problems.some(({ severity }) => severity === ERROR) ? EXIT_ERRORS : EXIT_OK;
}

module.exports = { RULES, lintFile, lintBank, run };

if (require.main === module) {
  process.exit(run(process.argv.slice(2)));
}
