#!/usr/bin/env node
// The design system engine every skill and the hook call, one command per job; usage is in `main` and the *_USAGE constants.
const fs = require("node:fs");
const path = require("node:path");
const { Refusal, load, unreadable, UI_DIR, WARNING, ERROR, ENGINE_REF } = require("./lib/project.cjs");
const { formatFindings } = require("./lib/common-rules.cjs");
const records = require("./lib/records.cjs");
const history = require("./lib/history.cjs");
const tokens = require("./lib/tokens.cjs");
const { writeResolver } = require("./lib/resolver.cjs");
const renders = require("./lib/renders.cjs");
const code = require("./lib/code.cjs");
const { usages } = require("./lib/graph.cjs");
const { extract } = require("./lib/extract.cjs");
const { bump, publish, validate: validateElements } = require("./lib/bump.cjs");

const CHECKS = { records, history, tokens, renders, code };
const VERDICT_VALID = "VALID";
const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const EXIT_USAGE = 2;
const EXIT_REFUSED = 2; // a request declined before anything is written
const PLUGIN = "aidd-ui";
const TOKENS_RULE = "T10";
// A message that opens with the line it is about; the line moves to the file.
const LINE_PREFIX = /^line (\d+): /;

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
        return [{ rule: "U2", severity: ERROR, file: UI_DIR, message: `check "${name}" failed: ${error.message}`, fix: `fix the input the error names, then run node ${ENGINE_REF} validate`, excerpt: name }];
      }
    }),
    ...unreadable(project),
  ];
}

/** Whether a problem blocks: anything a rule does not call a warning. */
const isError = (problem) => problem.severity !== WARNING;

/** A problem as the shared formatter reads it: the line a message opens with becomes its `line`
 * field, and leaves the message. */
function findingOf(problem) {
  const [, line] = problem.message.match(LINE_PREFIX) ?? [];
  const { file, rule, fix, excerpt, message } = problem;
  return { file, ...(line ? { line: Number(line) } : {}), rule, ...(excerpt === undefined ? {} : { excerpt }), fix, message: line ? message.replace(LINE_PREFIX, "") : message };
}

/** The problems as the formatter's `errors` and `warnings`. */
function findingsOf(problems) {
  return { errors: problems.filter(isError).map(findingOf), warnings: problems.filter((problem) => !isError(problem)).map(findingOf) };
}

/** Every problem through the shared formatter, the file relative to the project root, uncapped. */
const formatAll = (problems) => formatFindings(PLUGIN, findingsOf(problems), { warningsCap: Infinity });

function validate([root = process.cwd()]) {
  const project = load(root);
  if (project === null) return EXIT_VALID;
  const problems = problemsOf(project);
  console.log(problems.length ? formatAll(problems) : VERDICT_VALID);
  return problems.some(isError) ? EXIT_INVALID : EXIT_VALID;
}

/** Writes the Resolver from system.md and the context files, then regenerates the stylesheet the
 * renders load. A token with an error, or a composite token with no raw CSS, leaves the stylesheet
 * untouched: the problems are printed instead. */
function generateTokens([root = process.cwd()]) {
  const first = load(root);
  if (first === null) return EXIT_VALID;
  writeResolver(first);
  const project = load(root); // read again: the checks below read the Resolver just written
  const blocked = tokens.blockers(project);
  const { css, problems } = blocked.length ? { css: null, problems: blocked } : tokens.generate(project);
  const ruled = problems.map((problem) => ({ rule: TOKENS_RULE, ...problem })); // a composite without raw CSS is T10's
  if (css === null) {
    console.log(formatAll(ruled));
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
const CREATED_FLAG = "--created";
const REMOVED_FLAG = "--removed";
const BUMP_USAGE = `node aidd-ui.cjs bump ${TASK_FLAG} <aidd_docs/tasks/…> (${CHANGE_FLAG} "<text>" [${BREAKING_FLAG}] | ${CREATED_FLAG} | ${REMOVED_FLAG}) <token or id>… [${ROOT_FLAG} <dir>]`;
const PUBLISH_USAGE = `node aidd-ui.cjs publish ([${BREAKING_FLAG}] | <id>…) [${ROOT_FLAG} <dir>]`;
const EXTRACT_USAGE = `node aidd-ui.cjs extract [${FORCE_FLAG}] [${ROOT_FLAG} <dir>]`;

/** `args` as `{values, flags, rest}`: `values` holds each of `options` given with its value, `flags`
 * the set of `flags` given, `rest` every other argument in order. An option last on the line has no
 * value: `error` names it. */
function parse(args, { options = [], flags = [] }) {
  const values = {};
  const given = new Set();
  const rest = [];
  for (let at = 0; at < args.length; at += 1) {
    if (options.includes(args[at])) {
      if (at + 1 >= args.length) return { error: `${args[at]} needs a value` };
      values[args[at]] = args[(at += 1)];
    } else if (flags.includes(args[at])) given.add(args[at]);
    else rest.push(args[at]);
  }
  return { values, flags: given, rest };
}

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
    return EXIT_REFUSED;
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
  const { values, flags, rest, error } = parse(args, { options: [ROOT_FLAG, TASK_FLAG, CHANGE_FLAG], flags: [BREAKING_FLAG, CREATED_FLAG, REMOVED_FLAG] });
  const created = flags?.has(CREATED_FLAG);
  const removed = flags?.has(REMOVED_FLAG);
  // one of a change, a creation or a removal; a creation or a removal states no change
  const stated = created || removed ? !(created && removed) && values[CHANGE_FLAG] === undefined && !flags.has(BREAKING_FLAG) : values?.[CHANGE_FLAG] !== undefined;
  if (error || !rest.length || values[TASK_FLAG] === undefined || !stated) {
    console.error(`usage: ${BUMP_USAGE}`);
    return EXIT_USAGE;
  }
  return refusing(() => {
    const done = bump(values[ROOT_FLAG] ?? process.cwd(), { task: values[TASK_FLAG], change: values[CHANGE_FLAG], breaking: flags.has(BREAKING_FLAG), created, removed, refs: rest });
    console.log(JSON.stringify(done, null, 2));
    return EXIT_VALID;
  });
}

/** Writes the system's next publication, or with ids validates those elements, as the versions
 * rules say. */
function publishSystem(args) {
  const { values, flags, rest, error } = parse(args, { options: [ROOT_FLAG], flags: [BREAKING_FLAG] });
  if (error || (rest.length && flags.has(BREAKING_FLAG))) {
    console.error(`usage: ${PUBLISH_USAGE}`);
    return EXIT_USAGE;
  }
  const root = values[ROOT_FLAG] ?? process.cwd();
  return refusing(() => {
    console.log(JSON.stringify(rest.length ? validateElements(root, rest) : publish(root, { breaking: flags.has(BREAKING_FLAG) }), null, 2));
    return EXIT_VALID;
  });
}

const COMMANDS = { validate, tokens: generateTokens, impact, extract: extractTokens, bump: bumpVersions, publish: publishSystem };

function main([command, ...args]) {
  if (Object.hasOwn(COMMANDS, command)) return COMMANDS[command](args);
  console.error(`usage: node aidd-ui.cjs <validate|tokens> [project-root]\n       ${IMPACT_USAGE}\n       ${EXTRACT_USAGE}\n       ${BUMP_USAGE}\n       ${PUBLISH_USAGE}`);
  return EXIT_USAGE;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { problemsOf, findingOf, isError };
