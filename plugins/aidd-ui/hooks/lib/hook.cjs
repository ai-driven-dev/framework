// The engine's `hook` command: runs the design system checks after a write and at Stop, handing the
// same short text to every host through its adapter; at session start it sweeps old turn state and
// notes the errors the project holds.
const fs = require("node:fs");
const path = require("node:path");
const { load, relative, isUnder, UI_DIR } = require("./project.cjs");
const { codeRoots } = require("./code.cjs");
const { problemsOf, findingOf, isError } = require("../aidd-ui.cjs");
const {
  isShellWrite,
  formatFindings,
  changedLines,
  touchedLines,
  reachesTouched,
  turnMark,
  sweepTurns,
  readBaseline,
  leaveBaseline,
  readTurn,
  markWrite,
  leaveTurn,
  consumeTurn,
  tellOnce,
  requiredAtStop,
} = require("./common-rules.cjs");
const { readEvent, answer, continueTurn } = require("./host.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const STOP = "Stop";
const EXIT_SILENT = 0;
// A shell command marks the turn when it runs one of the engine's writing commands (flat or plugin install
// alike), or when it names the design system's folder and matches a write form the hooks share. Any other
// command only reads: `validate`, `impact`, and `publish` given ids, which validates them.
const ENGINE_RUN = /aidd-ui\.cjs["']?\s+(\w+)([^;&|\n]*)/g;
const ENGINE_WRITES = new Set(["tokens", "extract", "bump"]);
const PUBLISH_OPTIONS = /\s--breaking\b|\s--root\s+\S+/g;
const UI_FOLDER = /aidd_docs\/ui\//;
const PLUGIN = "aidd-ui";
// What the hook tells the model after a write: it informs, and Stop requires.
const INFORM = 1;

/** Whether a project-relative file belongs to the design system or to its code. */
const isWatched = (project, file) => [UI_DIR, ...codeRoots(project)].some((prefix) => isUnder(file, prefix));

/** Whether a shell command runs an engine command that writes: `publish` writes only without ids. */
function runsEngineWrite(command) {
  for (const [, name, args] of command.matchAll(ENGINE_RUN)) {
    if (ENGINE_WRITES.has(name) || (name === "publish" && args.replace(PUBLISH_OPTIONS, "").trim() === "")) return true;
  }
  return false;
}

/** Whether a shell command changes the design system or runs the engine where it writes. */
function marksTurn(command) {
  if (typeof command !== "string") return false;
  return runsEngineWrite(command) || (UI_FOLDER.test(command) && isShellWrite(command));
}

/** The problems in the shape the turn-end state reads: the formatter's finding, and whether it is an error. */
const normalized = (problems) => problems.map((problem) => ({ ...findingOf(problem), error: isError(problem) }));

/** A project file's text, or null when it cannot be read. */
function textOf(project, file) {
  try {
    return fs.readFileSync(path.join(project.root, file), "utf8");
  } catch {
    return null;
  }
}

/** Marks the turn, then hands the model what the write produced (rule 3 of the hooks' contract):
 * the errors on the lines it added or changed, one by one, then those lines' warnings. A file whose
 * changed lines are unknown has its errors grouped under its name. Errors the write left in another
 * file, new against the baseline, follow grouped, told once per turn: their fix is elsewhere, so they
 * only inform. */
function afterWrite(project, event) {
  const written = event.files
    .map((file) => ({ ...file, file: relative(project.root, path.resolve(project.root, file.path)) }))
    .filter(({ file }) => isWatched(project, file));
  const shell = !event.files.length;
  if (!shell && !written.length) return EXIT_SILENT;
  const mark = turnMark(PLUGIN, event.sessionId);
  const baseline = readBaseline(mark);
  const turn = readTurn(mark);
  for (const entry of written) markWrite(turn, { ...entry, whole: typeof entry.content === "string" });
  const found = normalized(problemsOf(project));
  const findings = { errors: [], reached: [], warnings: [] };
  for (const entry of written) {
    const changed = typeof entry.written === "string" ? changedLines(entry.written, entry.replaced) : null;
    const text = changed && textOf(project, entry.file);
    const touched = text === null ? null : touchedLines(text, changed);
    for (const finding of found.filter(({ file }) => file === entry.file)) {
      if (touched && finding.line !== undefined && !reachesTouched(finding, touched)) continue;
      if (!finding.error) findings.warnings.push(finding);
      else (touched ? findings.errors : findings.reached).push(finding);
    }
  }
  const files = written.map(({ file }) => file);
  findings.reached.push(...tellOnce(found, files, baseline, turn.told));
  leaveTurn(mark, turn);
  const text = formatFindings(PLUGIN, findings);
  if (text) answer({ level: INFORM, text });
  return EXIT_SILENT;
}

/** Holds the turn's end once on the errors it produced: those on the lines its writes changed, net,
 * and, when a baseline exists, past what it counts. The baseline then takes the project's errors as
 * they stand, so what was asked once is never asked again. */
function atStop(project, mark, turn) {
  const found = normalized(problemsOf(project));
  const required = requiredAtStop(turn, found, readBaseline(mark), (file) => textOf(project, file));
  leaveBaseline(mark, found);
  const reason = formatFindings(PLUGIN, { errors: required });
  if (reason) continueTurn(reason);
  return EXIT_SILENT;
}

/** Answers one host event; any failure answers nothing. */
function run() {
  const event = readEvent();
  if (!event) return EXIT_SILENT;
  if (event.event === SESSION_START) {
    sweepTurns(PLUGIN);
    const project = load(event.cwd);
    if (project !== null) leaveBaseline(turnMark(PLUGIN, event.sessionId), normalized(problemsOf(project)));
    return EXIT_SILENT;
  }
  // A shell command that only reads, and an ignored tool, do nothing: neither reads the project.
  if (event.event === POST_TOOL_USE && !event.files.length && !marksTurn(event.command)) return EXIT_SILENT;
  // Stop fires on every turn: one that wrote no watched file costs no read of the project.
  const mark = turnMark(PLUGIN, event.sessionId);
  const turn = event.event === STOP ? consumeTurn(mark) : null;
  if (event.event === STOP && turn === null) return EXIT_SILENT;
  const project = load(event.cwd);
  if (project === null) return EXIT_SILENT;
  if (event.event === POST_TOOL_USE) return afterWrite(project, event);
  return atStop(project, mark, turn);
}

function hook() {
  try {
    return run();
  } catch {
    return EXIT_SILENT;
  }
}

module.exports = { hook };
