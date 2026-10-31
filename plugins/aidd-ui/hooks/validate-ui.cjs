#!/usr/bin/env node
// Usage: node validate-ui.cjs [project-root]
// Checks a project's design system under aidd_docs/ui/: records, history, tokens, renders and
// code links. Prints VALID, or one line per problem and exits 1. Prints nothing without one.
const { load, unreadable, UI_DIR } = require("./lib/project.cjs");
const records = require("./lib/records.cjs");
const history = require("./lib/history.cjs");
const tokens = require("./lib/tokens.cjs");
const renders = require("./lib/renders.cjs");
const code = require("./lib/code.cjs");

const CHECKS = { records, history, tokens, renders, code };
const VERDICT_VALID = "VALID";
const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const PROBLEM_MARK = "✗";

/** Every problem of a loaded project, check by check, then each file no check could read. A
 * check that throws is one problem naming it, so the others still speak. */
const problemsOf = (project, checks = CHECKS) => [
  ...Object.entries(checks).flatMap(([name, check]) => {
    try {
      return check.check(project);
    } catch (error) {
      return [{ file: UI_DIR, message: `check "${name}" failed: ${error.message}` }];
    }
  }),
  ...unreadable(project),
];

/** The problems of the design system under `root`, or null when it has none. */
function validate(root) {
  const project = load(root);
  return project === null ? null : problemsOf(project);
}

/** One `✗ <file>: <message>` line per problem, the file relative to the project root. */
const format = (problems) => problems.map((problem) => `${PROBLEM_MARK} ${problem.file}: ${problem.message}`);

function main(args) {
  const problems = validate(args[0] ?? process.cwd());
  if (problems === null) return EXIT_VALID;
  console.log(problems.length ? format(problems).join("\n") : VERDICT_VALID);
  return problems.length ? EXIT_INVALID : EXIT_VALID;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { validate, problemsOf, format };
