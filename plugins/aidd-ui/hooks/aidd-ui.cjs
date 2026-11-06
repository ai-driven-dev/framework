#!/usr/bin/env node
// Usage: node aidd-ui.cjs <command> [project-root]
// The design system engine the hook and every skill call, one command per job:
//   validate  checks records, history, tokens, renders and code links. Prints VALID, or one line
//             per problem, and exits 1 when an error remains. Prints nothing without a design system.
const { load, unreadable, UI_DIR, WARNING } = require("./lib/project.cjs");
const records = require("./lib/records.cjs");
const history = require("./lib/history.cjs");
const tokens = require("./lib/tokens.cjs");
const renders = require("./lib/renders.cjs");
const code = require("./lib/code.cjs");

const CHECKS = { records, history, tokens, renders, code };
const VERDICT_VALID = "VALID";
const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const EXIT_USAGE = 2;
const ERROR_MARK = "✗";
const WARNING_MARK = "⚠";

/** Every problem of a loaded project, check by check, then each file no check could read. A
 * check that throws is one problem naming it, so the others still speak. A design system
 * written for another format is that one problem alone. */
function problemsOf(project, checks = CHECKS) {
  const otherFormat = records.formatProblem(project);
  if (otherFormat) return [otherFormat];
  return [
    ...Object.entries(checks).flatMap(([name, check]) => {
      try {
        return check.check(project);
      } catch (error) {
        return [{ file: UI_DIR, message: `check "${name}" failed: ${error.message}` }];
      }
    }),
    ...unreadable(project),
  ];
}

/** Whether a problem blocks: anything a rule does not call a warning. */
const isError = (problem) => problem.severity !== WARNING;

/** One `✗ <file>: <message> (<rule>)` line per problem, `⚠` for a warning, the file relative to
 * the project root. */
const format = (problems) => problems.map((problem) => `${isError(problem) ? ERROR_MARK : WARNING_MARK} ${problem.file}: ${problem.message}${problem.rule ? ` (${problem.rule})` : ""}`);

function validate(root) {
  const project = load(root);
  if (project === null) return EXIT_VALID;
  const problems = problemsOf(project);
  console.log(problems.length ? format(problems).join("\n") : VERDICT_VALID);
  return problems.some(isError) ? EXIT_INVALID : EXIT_VALID;
}

const COMMANDS = { validate };

function main([command, root = process.cwd()]) {
  if (Object.hasOwn(COMMANDS, command)) return COMMANDS[command](root);
  console.error(`usage: node aidd-ui.cjs <${Object.keys(COMMANDS).join("|")}> [project-root]`);
  return EXIT_USAGE;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { problemsOf, format, isError };
