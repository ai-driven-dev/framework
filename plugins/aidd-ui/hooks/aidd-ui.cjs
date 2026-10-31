#!/usr/bin/env node
// Usage: node aidd-ui.cjs <validate|tokens> [project-root]
//        node aidd-ui.cjs impact <id or token>… [--root <dir>]
// The design system engine the hook and every skill call, one command per job:
//   validate  checks records, history, tokens, renders and code links. Prints VALID, or one line
//             per problem, and exits 1 when an error remains. Prints nothing without a design system.
//   tokens    writes aidd_docs/ui/tokens.css from the tokens and prints its path. Writes nothing and
//             exits 1 while a token has an error or a composite token has no raw CSS.
//   impact    prints as JSON what a change to those tokens, by path or CSS name, or elements reaches:
//             tokens, elements, screens, journeys, renders and code files, each sorted. An unknown ref is named on
//             stderr and exits 2.
const fs = require("node:fs");
const path = require("node:path");
const { load, unreadable, UI_DIR, WARNING } = require("./lib/project.cjs");
const records = require("./lib/records.cjs");
const history = require("./lib/history.cjs");
const tokens = require("./lib/tokens.cjs");
const renders = require("./lib/renders.cjs");
const code = require("./lib/code.cjs");
const { usages } = require("./lib/graph.cjs");

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

function validate([root = process.cwd()]) {
  const project = load(root);
  if (project === null) return EXIT_VALID;
  const problems = problemsOf(project);
  console.log(problems.length ? format(problems).join("\n") : VERDICT_VALID);
  return problems.some(isError) ? EXIT_INVALID : EXIT_VALID;
}

/** Regenerates the stylesheet the renders load. A token with an error, or a composite token with no
 * raw CSS, leaves it untouched: the problems are printed instead. */
function generateTokens([root = process.cwd()]) {
  const project = load(root);
  if (project === null) return EXIT_VALID;
  const blocked = tokens.blockers(project);
  const { css, problems } = blocked.length ? { css: null, problems: blocked } : tokens.generate(project);
  if (css === null) {
    console.log(format(problems).join("\n"));
    return EXIT_INVALID;
  }
  const file = tokens.cssFileOf(project);
  fs.writeFileSync(path.join(root, file), css);
  console.log(file);
  return EXIT_VALID;
}

const ROOT_FLAG = "--root";
const IMPACT_USAGE = `node aidd-ui.cjs impact <id or token>… [${ROOT_FLAG} <dir>]`;

/** What the tokens and elements named change, read from the same graph the hook uses. */
function impact(args) {
  const at = args.indexOf(ROOT_FLAG);
  const root = at < 0 ? process.cwd() : args[at + 1];
  const refs = args.filter((arg, index) => at < 0 || (index !== at && index !== at + 1));
  if (!refs.length || root === undefined) {
    console.error(`usage: ${IMPACT_USAGE}`);
    return EXIT_USAGE;
  }
  const project = load(root);
  if (project === null) return EXIT_VALID;
  const { unknown, ...report } = usages(project, refs);
  if (unknown) {
    for (const ref of unknown) console.error(`aidd-ui: no token or element named "${ref}"`);
    return EXIT_USAGE;
  }
  console.log(JSON.stringify(report, null, 2));
  return EXIT_VALID;
}

const COMMANDS = { validate, tokens: generateTokens, impact };

function main([command, ...args]) {
  if (Object.hasOwn(COMMANDS, command)) return COMMANDS[command](args);
  console.error(`usage: node aidd-ui.cjs <validate|tokens> [project-root]\n       ${IMPACT_USAGE}`);
  return EXIT_USAGE;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { problemsOf, format, isError };
