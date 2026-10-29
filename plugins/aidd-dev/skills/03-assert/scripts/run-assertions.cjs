#!/usr/bin/env node
// Usage: node run-assertions.cjs [<task folder>] [-- <command>...]
// Runs the project's checks, none skipped after a failure, says PASS, FAIL or EMPTY on its first
// line, then the round. Given a task folder, aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug> of the project
// whose assertions it runs, it appends the round to that folder's assert.md; it refuses any other folder.
// The checks are the commands given after --, one argument each, else the "Before commit" table
// of the closest aidd_docs/memory/coding-assertions.md at or above the task folder, or the current
// one, run from its folder.
// It changes nothing else: a judge, never a fixer.
// Limits: a command that never ends is not cut, a command that needs a commit message is skipped,
// and a command that checks only staged files passes on nothing when nothing is staged.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ASSERTIONS_FILE = path.join("aidd_docs", "memory", "coding-assertions.md");
const GATE_HEADING = "## Before commit";
const COMMAND_COLUMN = "Command";
const COMMANDS_SEPARATOR = "--";
const REPORT_FILE = "assert.md";
const ROUND_HEADING = /^## Round /gm;
const TAIL_LINES = 20;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_EMPTY = 2;
const EXIT_STOP = 3;
const NEXT_LABEL = "NEXT:";
const REPORT_LABEL = "REPORT:";

const LINE_BREAK = "\n";
const TABLE_CELL_SEPARATOR = "|";
const NUL = "\0"; // git's -z output ends each path with a NUL
const WINDOWS_LINE_ENDING = /\r\n/g;
const ANY_HEADING = /^## /m;
const TASK_FOLDER = /^aidd_docs\/tasks\/\d{4}_\d{2}\/\d{4}_\d{2}_\d{2}_[a-z0-9-]+$/;
const SINGLE_COMMAND_CELL = /^`([^`]+)`$/;
const PLACEHOLDER = /^`?<.*>`?$/;
const NEEDS_COMMIT_MESSAGE = /--edit\b/;
const TABLE_SEPARATOR_ROW = /^\|[\s:|-]+\|$/;

const git = (folder, args) => spawnSync("git", ["-C", folder, ...args], { encoding: "utf8" });

function gateRows(markdown) {
  const section = (markdown.replace(WINDOWS_LINE_ENDING, LINE_BREAK).split(GATE_HEADING)[1] ?? "").split(ANY_HEADING)[0];
  const rows = section.split(LINE_BREAK).filter((line) => line.startsWith(TABLE_CELL_SEPARATOR) && !TABLE_SEPARATOR_ROW.test(line));
  const cells = rows.map((row) => row.split(TABLE_CELL_SEPARATOR).slice(1, -1).map((cell) => cell.trim()));
  const column = cells[0]?.indexOf(COMMAND_COLUMN) ?? -1;
  const commandCells = column < 0 ? [] : cells.slice(1).map((row) => row[column] ?? "");
  const kept = commandCells.filter((cell) => cell && cell !== COMMAND_COLUMN && !PLACEHOLDER.test(cell));
  return {
    commands: kept.filter((cell) => SINGLE_COMMAND_CELL.test(cell)).map((cell) => cell.match(SINGLE_COMMAND_CELL)[1]),
    unreadable: kept.filter((cell) => !SINGLE_COMMAND_CELL.test(cell)),
  };
}

function projectFolder(start) {
  for (let folder = start; ; folder = path.dirname(folder)) {
    if (fs.existsSync(path.join(folder, ASSERTIONS_FILE))) return folder;
    if (fs.existsSync(path.join(folder, ".git"))) return folder;
    if (folder === path.dirname(folder)) return start;
  }
}

function runCommand(folder, command) {
  if (NEEDS_COMMIT_MESSAGE.test(command)) return { command, status: "SKIPPED", tail: [] };
  const result = spawnSync(command, { cwd: folder, shell: true, encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES });
  const status = result.status === 0 ? "PASS" : "FAIL";
  const tail = `${result.stdout}${result.stderr}`.trimEnd().split(LINE_BREAK).slice(-TAIL_LINES);
  return { command, status, code: result.status, tail: status === "FAIL" ? tail : [] };
}

/** The commit judged, and whether uncommitted changes came with it, read before any check can write; the report is not a change. */
function judgedTree(folder, report) {
  const root = git(folder, ["rev-parse", "--show-toplevel"]).stdout.trim();
  if (!root) return "not a git repository";
  const head = git(folder, ["rev-parse", "--short", "HEAD"]).stdout.trim() || "no commit";
  const changes = git(root, ["status", "--porcelain", "-z", "--untracked-files=all"]).stdout.split(NUL).filter(Boolean)
    .filter((entry) => !report || !fs.existsSync(report) || path.resolve(root, entry.slice(3)) !== fs.realpathSync(report));
  return changes.length ? `\`${head}\` plus uncommitted changes` : `\`${head}\``;
}

const cell = (text) => text.replaceAll(TABLE_CELL_SEPARATOR, `\\${TABLE_CELL_SEPARATOR}`);

function roundOf(number, verdict, tree, results, unreadable) {
  return [
    `## Round ${number}`,
    "",
    `- Head: ${tree}`,
    `- Verdict: ${verdict}`,
    ...unreadable.map((row) => `- Not run, not a single command: ${row}`),
    "",
    "| Check | Exit |",
    "| --- | --- |",
    ...results.map((result) => `| \`${cell(result.command)}\` | ${result.status === "SKIPPED" ? "skipped" : result.code} |`),
    ...results.filter((result) => result.status === "FAIL").flatMap((result) => [
      "",
      `### \`${result.command}\``,
      "",
      "```text",
      ...result.tail,
      "```",
    ]),
    "",
  ].join(LINE_BREAK);
}

function main(args) {
  const split = args.indexOf(COMMANDS_SEPARATOR);
  const given = split < 0 ? [] : args.slice(split + 1);
  const taskFolder = (split < 0 ? args : args.slice(0, split))[0];
  const folder = projectFolder(path.resolve(taskFolder ?? "."));
  if (taskFolder && !TASK_FOLDER.test(path.relative(folder, path.resolve(taskFolder)).split(path.sep).join("/"))) {
    console.log(["STOP", `not a task folder: ${taskFolder}`, `${NEXT_LABEL} run again on ${path.join(folder, "aidd_docs", "tasks")}/<yyyy_mm>/<yyyy_mm_dd>_<slug>, or on no folder`].join(LINE_BREAK));
    process.exit(EXIT_STOP);
  }
  const report = taskFolder && path.join(path.resolve(taskFolder), REPORT_FILE);
  const assertionsPath = path.join(folder, ASSERTIONS_FILE);
  const table = !given.length && fs.existsSync(assertionsPath) ? gateRows(fs.readFileSync(assertionsPath, "utf8")) : { commands: [], unreadable: [] };

  const commands = given.length ? given : table.commands;
  if (!commands.length) {
    const where = fs.existsSync(assertionsPath) ? `read ${assertionsPath}` : "read the project's manifest (its test, typecheck and lint scripts)";
    console.log(["EMPTY", `no check found in ${assertionsPath}`, `${NEXT_LABEL} ${where}, then run this script again with each check after --`].join(LINE_BREAK));
    process.exit(EXIT_EMPTY);
  }

  const tree = judgedTree(folder, report);
  const results = commands.map((command) => runCommand(folder, command));
  const verdict = results.some((result) => result.status === "FAIL") ? "FAIL" : "PASS";
  const earlier = report && fs.existsSync(report) ? fs.readFileSync(report, "utf8") : "";
  const round = roundOf((earlier.match(ROUND_HEADING) ?? []).length + 1, verdict, tree, results, table.unreadable);
  if (report) {
    fs.mkdirSync(path.dirname(report), { recursive: true });
    fs.writeFileSync(report, earlier ? `${earlier.trimEnd()}${LINE_BREAK}${LINE_BREAK}${round}` : `# Assert${LINE_BREAK}${LINE_BREAK}${round}`);
  }
  console.log([verdict, round, ...(report ? [`${REPORT_LABEL} ${report}`] : [])].join(LINE_BREAK));
  process.exit(verdict === "PASS" ? EXIT_PASS : EXIT_FAIL);
}

main(process.argv.slice(2));
