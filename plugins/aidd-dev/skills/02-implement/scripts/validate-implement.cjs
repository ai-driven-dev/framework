#!/usr/bin/env node
// Usage: node validate-implement.cjs <feature-folder> [--baseline]
// Checks that the statuses of a plan and of its phases tell a possible story; writes nothing.
// Once the plan is implemented or blocked, also names the files still uncommitted.
// With --baseline, records the files already modified; no later commit may hold one of them.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PLAN_FILE = "plan.md";
const RUN_FILE = "run.md";
const PLAN_STATUSES = ["pending", "in-progress", "implemented", "blocked"];
const PHASE_STATUSES = ["pending", "in-progress", "done"];
const CLOSED_PLAN_STATUSES = ["implemented", "blocked"];
const NO_DEPENDENCY = "none";
const MAX_LISTED_FILES = 5;
const PHASE_ROW_MIN_CELLS = 4; // number, name, file, Depends on
const PORCELAIN_STATUS_WIDTH = 2;
const PORCELAIN_PATH_OFFSET = PORCELAIN_STATUS_WIDTH + 1; // the status letters and a space

const EXIT_OK = 0;
const EXIT_STATE = 1;
const VERDICT_OK = "OK";
const VERDICT_STATE = "STATE";
const NOTE_LABEL = "NOTE";
const FLAG_PREFIX = "--";
const BASELINE_FLAG = "--baseline";
const BASELINE_FILE = "aidd-implement-baseline.json";
const FROM_REPOSITORY_ROOT = ":(top,literal)"; // git pathspec: the name is root-relative, not cwd-relative
const NEXT_LABEL = "NEXT:";
const BASELINE_KEPT_NOTE = `${NOTE_LABEL} baseline kept: the plan has started`;

const LINE_BREAK = "\n";
const TABLE_CELL_SEPARATOR = "|";
const GIT_RECORD_SEPARATOR = "\0"; // `git status -z` ends each path with a NUL
const GIT_STATUS_ARGUMENTS = ["status", "--porcelain", "-z", "--untracked-files=all"];

const WINDOWS_LINE_ENDING = /\r\n/g;
const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;
const STATUS_LINE = /^status:\s*(.*)$/m;
const RUN_BLOCK_START = /^(?=## Run\b)/m;
const HEAD_LINE = /^- Head:\s*`([0-9a-f]{7,40})`\s*$/m;
const LEFT_LINE = /^- Left:\s*\S/m;
const UNFILLED_TEMPLATE = /\{\{|<!--/;
const RESULT_TABLE_HEADER = /^\|\s*Task\s*\|\s*Validation\s*\|\s*Result\s*\|\s*$/;
const TASK_HEADING = /^###\s*`?(\d+)\)/gm;
const TABLE_SEPARATOR_ROW = /^\|[\s:|-]+\|$/;
const PHASES_HEADING = /^## Phases$/m;
const ANY_HEADING = /^## /m;
const PHASE_NUMBER = /^\d+$/;
const BACKTICKS = /`/g;
const LIST_SEPARATOR = /\s*,\s*/;
const RENAME_OR_COPY = /[RC]/;

const phaseFileName = (number) => `phase-${number}.md`;
const listWithOr = (values) => `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;

function readMarkdown(file) {
  return fs.readFileSync(file, "utf8").replace(WINDOWS_LINE_ENDING, LINE_BREAK);
}

function statusOf(markdown) {
  const line = markdown.match(FRONT_MATTER)?.[1].match(STATUS_LINE);
  return line?.[1].trim();
}

function statusProblems(file, status, allowed) {
  if (status === undefined) return [`${file}: front matter key "status" missing`];
  if (allowed.includes(status)) return [];
  return [`${file}: status "${status}" must be ${listWithOr(allowed)}`];
}

function parseDependencies(cell) {
  const text = cell.replace(BACKTICKS, "");
  return text === NO_DEPENDENCY ? [] : text.split(LIST_SEPARATOR).map(Number);
}

function phaseRows(plan) {
  const phasesSection = (plan.split(PHASES_HEADING)[1] ?? "").split(ANY_HEADING)[0];
  return phasesSection
    .split(LINE_BREAK)
    .map((line) => line.split(TABLE_CELL_SEPARATOR).slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => PHASE_NUMBER.test(cells[0] ?? "") && cells.length >= PHASE_ROW_MIN_CELLS);
}

function readPhase(folder, cells) {
  const number = Number(cells[0]);
  const file = phaseFileName(number);
  const fullPath = path.join(folder, file);
  const status = fs.existsSync(fullPath) ? statusOf(readMarkdown(fullPath)) : undefined;
  const exists = fs.existsSync(fullPath);
  const tasks = exists ? [...readMarkdown(fullPath).matchAll(TASK_HEADING)].map((match) => `${number}.${match[1]}`) : [];
  return { number, file, exists, status, tasks, dependencies: parseDependencies(cells.at(-1)) };
}

const describeStatus = (phase) => phase.status ?? "missing";

function pendingPlanProblems(planStatus, phases) {
  if (planStatus !== "pending") return [];
  return phases
    .filter((phase) => phase.status && phase.status !== "pending")
    .map((phase) => `${PLAN_FILE}: status pending but phase ${phase.number} is ${phase.status}`);
}

function implementedPlanProblems(planStatus, phases) {
  if (planStatus !== "implemented") return [];
  return phases
    .filter((phase) => phase.status !== "done")
    .map((phase) => `${PLAN_FILE}: status implemented but phase ${phase.number} is ${describeStatus(phase)}`);
}

function singleRunningPhaseProblems(planStatus, phases) {
  if (planStatus === "blocked") return [];
  const running = phases.filter((phase) => phase.status === "in-progress");
  return running.length > 1 ? [`${PLAN_FILE}: phases ${listNumbers(running)} are in-progress together`] : [];
}

function startedAfterDependenciesProblems(planStatus, phases) {
  if (planStatus === "blocked") return [];
  const byNumber = new Map(phases.map((phase) => [phase.number, phase]));
  const started = phases.filter((phase) => phase.status === "in-progress" || phase.status === "done");
  return started.flatMap((phase) =>
    phase.dependencies
      .map((number) => byNumber.get(number))
      .filter((dependency) => dependency && dependency.status !== "done")
      .map((dependency) => `${PLAN_FILE}: phase ${phase.number} is ${phase.status} but depends on phase ${dependency.number} (${describeStatus(dependency)})`)
  );
}

const PROGRESS_RULES = [pendingPlanProblems, implementedPlanProblems, singleRunningPhaseProblems, startedAfterDependenciesProblems];

const noRunProblem = `${RUN_FILE}: no "## Run" recorded, append one`;

function isCommit(folder, sha) {
  const inRepository = spawnSync("git", ["-C", folder, "rev-parse", "--git-dir"], { encoding: "utf8" });
  if (inRepository.status !== 0) return undefined;
  return spawnSync("git", ["-C", folder, "cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

function resultRows(block) {
  const rows = block.split(LINE_BREAK).filter((line) => line.startsWith(TABLE_CELL_SEPARATOR));
  const results = rows.filter((row) => !RESULT_TABLE_HEADER.test(row) && !TABLE_SEPARATOR_ROW.test(row));
  return results.map((row) => row.split(TABLE_CELL_SEPARATOR).slice(1, -1).map((cell) => cell.trim()));
}

const hasResultRow = (block) => resultRows(block).some((cells) => cells.every(Boolean));

function uncoveredTaskProblems(block, number, phases) {
  const covered = new Set(resultRows(block).map((cells) => cells[0]));
  return phases
    .flatMap((phase) => phase.tasks)
    .filter((task) => !covered.has(task))
    .map((task) => `${RUN_FILE}: run ${number} has no row for task ${task}`);
}

function headProblems(folder, label, head) {
  if (!head) return [`${label}: "Head:" needs a commit sha`];
  return isCommit(folder, head) === false ? [`${label}: head ${head} is not a commit`] : [];
}

function singleRunProblems(folder, block, number) {
  const label = `${RUN_FILE}: run ${number}`;
  return [
    ...headProblems(folder, label, block.match(HEAD_LINE)?.[1]),
    ...(hasResultRow(block) ? [] : [`${label}: needs a "Task | Validation | Result" table with a row`]),
    ...(LEFT_LINE.test(block) ? [] : [`${label}: "Left:" missing`]),
  ];
}

function runRecordProblems(folder, planStatus, phases) {
  if (planStatus !== "implemented") return [];
  const runPath = path.join(folder, RUN_FILE);
  if (!fs.existsSync(runPath)) return [noRunProblem];
  const markdown = readMarkdown(runPath);
  const blocks = markdown.split(RUN_BLOCK_START).slice(1);
  if (!blocks.length) return [noRunProblem];
  return [
    ...(UNFILLED_TEMPLATE.test(markdown) ? [`${RUN_FILE}: placeholder or comment left, fill the run or delete it`] : []),
    ...blocks.flatMap((block, index) => singleRunProblems(folder, block, index + 1)),
    ...uncoveredTaskProblems(blocks.at(-1), blocks.length, phases),
  ];
}

const listNumbers = (phases) => phases.map((phase) => phase.number).join(", ");

function readyPhases(phases) {
  const byNumber = new Map(phases.map((phase) => [phase.number, phase]));
  const isDone = (number) => byNumber.get(number)?.status === "done";
  return phases.filter((phase) => phase.status === "pending" && phase.dependencies.every(isDone));
}

function nextStep(planStatus, phases) {
  if (CLOSED_PLAN_STATUSES.includes(planStatus)) return undefined;
  const running = phases.filter((phase) => phase.status === "in-progress");
  const ready = readyPhases(phases);
  const start = planStatus === "pending" ? "mark the plan in-progress, then " : "";
  if (running.length) return `phase ${listNumbers(running)} is in progress: build its next task, or close it`;
  if (ready.length) return `${start}take phase ${ready[0].number}`;
  if (phases.every((phase) => phase.status === "done")) return "every phase is done: read actions/03-finalize.md";
  return "no phase is ready, stop and ask";
}

const git = (folder, args) => spawnSync("git", ["-C", folder, ...args], { encoding: "utf8" });

function baselinePath(folder) {
  const gitDir = git(folder, ["rev-parse", "--absolute-git-dir"]);
  return gitDir.status === 0 ? path.join(gitDir.stdout.trim(), BASELINE_FILE) : undefined;
}

function recordBaseline(folder) {
  const file = baselinePath(folder);
  if (!file) return [];
  const featurePrefix = git(folder, ["rev-parse", "--show-prefix"]).stdout.trim();
  const files = uncommittedFiles(folder).filter((name) => !(featurePrefix && name.startsWith(featurePrefix)));
  const head = git(folder, ["rev-parse", "HEAD"]).stdout.trim();
  fs.writeFileSync(file, JSON.stringify({ folder: path.resolve(folder), head, files }));
  return files;
}

function readBaseline(folder) {
  const file = baselinePath(folder);
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    return record.folder === path.resolve(folder) && record.head ? record : undefined;
  } catch {
    return undefined;
  }
}

function baselineProblems(folder) {
  const record = readBaseline(folder);
  if (!record || git(folder, ["merge-base", "--is-ancestor", record.head, "HEAD"]).status !== 0) return [];
  const committed = new Set(git(folder, ["diff", "--name-only", "-z", `${record.head}..HEAD`]).stdout.split(GIT_RECORD_SEPARATOR).filter(Boolean));
  return record.files
    .filter((name) => committed.has(name))
    .map((name) => {
      const sha = git(folder, ["log", "-1", "--format=%h", `${record.head}..HEAD`, "--", `${FROM_REPOSITORY_ROOT}${name}`]).stdout.trim();
      return `${name}: modified before the start, yet committed in ${sha}: undo that commit (git reset --soft ${sha}~1) and commit again without it`;
    });
}

const alreadyModifiedNote = (files) => `${NOTE_LABEL} already modified (${files.length}): ${files.slice(0, MAX_LISTED_FILES).join(", ")}`;

function skipsRenamedOrigin(entry) {
  return RENAME_OR_COPY.test(entry.slice(0, PORCELAIN_STATUS_WIDTH));
}

function uncommittedFiles(folder) {
  const result = spawnSync("git", ["-C", folder, ...GIT_STATUS_ARGUMENTS], { encoding: "utf8" });
  if (result.status !== 0) return [];
  const entries = result.stdout.split(GIT_RECORD_SEPARATOR).filter(Boolean);
  const { paths } = entries.reduce(
    ({ paths, skipOrigin }, entry) =>
      skipOrigin ? { paths, skipOrigin: false } : { paths: [...paths, entry.slice(PORCELAIN_PATH_OFFSET)], skipOrigin: skipsRenamedOrigin(entry) },
    { paths: [], skipOrigin: false }
  );
  return paths;
}

function uncommittedNote(files) {
  return `${NOTE_LABEL} uncommitted files (${files.length}): ${files.slice(0, MAX_LISTED_FILES).join(", ")}`;
}

function finish(verdict, lines, exitCode) {
  console.log([verdict, ...lines].join(LINE_BREAK));
  process.exit(exitCode);
}

function main(args) {
  const folder = args.find((arg) => !arg.startsWith(FLAG_PREFIX));
  const flags = args.filter((arg) => arg.startsWith(FLAG_PREFIX));
  if (!folder) finish(VERDICT_STATE, ["usage: node validate-implement.cjs <feature-folder>"], EXIT_STATE);
  const planPath = path.join(folder, PLAN_FILE);
  if (!fs.existsSync(planPath)) finish(VERDICT_STATE, [`${planPath}: missing, write the plan first`], EXIT_STATE);

  const plan = readMarkdown(planPath);
  const planStatus = statusOf(plan);

  if (flags.includes(BASELINE_FLAG)) {
    if (planStatus !== "pending") finish(VERDICT_OK, [BASELINE_KEPT_NOTE], EXIT_OK);
    const recorded = recordBaseline(folder);
    finish(VERDICT_OK, recorded.length ? [alreadyModifiedNote(recorded)] : [], EXIT_OK);
  }

  const phases = phaseRows(plan).map((cells) => readPhase(folder, cells));

  const problems = [
    ...statusProblems(PLAN_FILE, planStatus, PLAN_STATUSES),
    ...phases.filter((phase) => phase.exists).flatMap((phase) => statusProblems(phase.file, phase.status, PHASE_STATUSES)),
    ...PROGRESS_RULES.flatMap((rule) => rule(planStatus, phases)),
    ...runRecordProblems(folder, planStatus, phases),
    ...baselineProblems(folder),
  ];
  if (problems.length) finish(VERDICT_STATE, problems, EXIT_STATE);

  const left = CLOSED_PLAN_STATUSES.includes(planStatus) ? uncommittedFiles(folder) : [];
  const next = nextStep(planStatus, phases);
  finish(VERDICT_OK, [...(left.length ? [uncommittedNote(left)] : []), ...(next ? [`${NEXT_LABEL} ${next}`] : [])], EXIT_OK);
}

main(process.argv.slice(2));
