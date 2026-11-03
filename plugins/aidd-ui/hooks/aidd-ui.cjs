#!/usr/bin/env node
// Usage: node aidd-ui.cjs <validate|tokens> [project-root]
//        node aidd-ui.cjs impact <id or token>… [--root <dir>]
//        node aidd-ui.cjs extract [--force] [--root <dir>]
// The design system engine the hook and every skill call, one command per job:
//   validate  checks records, history, tokens, renders and code links. Prints VALID, or one line
//             per problem, and exits 1 when an error remains. Prints nothing without a design system.
//   tokens    writes aidd_docs/ui/tokens.css from the tokens and prints its path. Writes nothing and
//             exits 1 while a token has an error or a composite token has no raw CSS.
//   impact    prints as JSON what a change to those tokens, by path or CSS name, or elements reaches:
//             tokens, the tokens holding the same value without citing them, elements, screens, journeys, renders and code
//             files, each sorted. An unknown ref is named on stderr and exits 2.
//   bump      raises the versions a change to those refs reaches, and prints as JSON the files it changed. A refusal
//             before any write exits 2.
//   extract   writes the token files from the code-tokens files of system.md, and prints as JSON what it wrote and
//             what it left. Exits 1 with a message when it cannot, or when tokens.json exists and --force is not given.
const fs = require("node:fs");
const path = require("node:path");
const { load, unreadable, UI_DIR, WARNING } = require("./lib/project.cjs");
const records = require("./lib/records.cjs");
const history = require("./lib/history.cjs");
const tokens = require("./lib/tokens.cjs");
const renders = require("./lib/renders.cjs");
const code = require("./lib/code.cjs");
const { usages } = require("./lib/graph.cjs");
const { extract } = require("./lib/extract.cjs");
const { bump } = require("./lib/bump.cjs");
const { parse, Refusal } = require("./lib/args.cjs");

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
const FORCE_FLAG = "--force";
const IMPACT_USAGE = `node aidd-ui.cjs impact <id or token>… [${ROOT_FLAG} <dir>]`;
const TASK_FLAG = "--task";
const CHANGE_FLAG = "--change";
const BREAKING_FLAG = "--breaking";
const BUMP_USAGE = `node aidd-ui.cjs bump ${TASK_FLAG} <aidd_docs/tasks/…> ${CHANGE_FLAG} "<text>" [${BREAKING_FLAG}] <token or id>… [${ROOT_FLAG} <dir>]`;
const EXTRACT_USAGE = `node aidd-ui.cjs extract [${FORCE_FLAG}] [${ROOT_FLAG} <dir>]`;

/** What the tokens and elements named change, read from the same graph the hook uses. */
function impact(args) {
  const { values, rest, error } = parse(args, { options: [ROOT_FLAG] });
  if (error || !rest.length) {
    console.error(`usage: ${IMPACT_USAGE}`);
    return EXIT_USAGE;
  }
  const project = load(values[ROOT_FLAG] ?? process.cwd());
  if (project === null) return EXIT_VALID;
  const { unknown, ...report } = usages(project, rest);
  if (unknown) {
    for (const ref of unknown) console.error(`aidd-ui: no token or element named "${ref}"`);
    return EXIT_USAGE;
  }
  console.log(JSON.stringify(report, null, 2));
  return EXIT_VALID;
}

/** Runs a command that refuses with a message and an exit code instead of printing a result. */
function refusing(run) {
  try {
    return run();
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    console.error(`aidd-ui: ${error.message}`);
    return error.code;
  }
}

/** Writes the token files from the code the design system names, and says what it left. */
function extractTokens(args) {
  const { values, flags, rest, error } = parse(args, { options: [ROOT_FLAG], flags: [FORCE_FLAG] });
  if (error || rest.length) {
    console.error(`usage: ${EXTRACT_USAGE}`);
    return EXIT_USAGE;
  }
  return refusing(() => {
    console.log(JSON.stringify(extract(values[ROOT_FLAG] ?? process.cwd(), { force: flags.has(FORCE_FLAG) }), null, 2));
    return EXIT_VALID;
  });
}

/** Raises the versions a change reaches, as the versions rules say. */
function bumpVersions(args) {
  const { values, flags, rest, error } = parse(args, { options: [ROOT_FLAG, TASK_FLAG, CHANGE_FLAG], flags: [BREAKING_FLAG] });
  if (error || !rest.length || values[TASK_FLAG] === undefined || values[CHANGE_FLAG] === undefined) {
    console.error(`usage: ${BUMP_USAGE}`);
    return EXIT_USAGE;
  }
  return refusing(() => {
    const done = bump(values[ROOT_FLAG] ?? process.cwd(), { task: values[TASK_FLAG], change: values[CHANGE_FLAG], breaking: flags.has(BREAKING_FLAG), refs: rest });
    console.log(JSON.stringify(done, null, 2));
    return EXIT_VALID;
  });
}

const COMMANDS = { validate, tokens: generateTokens, impact, extract: extractTokens, bump: bumpVersions };

function main([command, ...args]) {
  if (Object.hasOwn(COMMANDS, command)) return COMMANDS[command](args);
  console.error(`usage: node aidd-ui.cjs <validate|tokens> [project-root]\n       ${IMPACT_USAGE}\n       ${EXTRACT_USAGE}\n       ${BUMP_USAGE}`);
  return EXIT_USAGE;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { problemsOf, format, isError };
