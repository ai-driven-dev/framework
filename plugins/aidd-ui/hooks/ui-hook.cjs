// Runs the design system checks after a write and at Stop, handing the same short text to every host
// through its adapter; at session start it only sweeps old turn marks.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load, relative, isUnder, UI_DIR } = require("./lib/project.cjs");
const { codeRoots } = require("./lib/code.cjs");
const { reached } = require("./lib/graph.cjs");
const { problemsOf, findingOf, isError } = require("./aidd-ui.cjs");
const { isShellWrite, formatFindings } = require("./lib/common-rules.cjs");
const { readEvent, answer, continueTurn } = require("./lib/host.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const STOP = "Stop";
const EXIT_SILENT = 0;
// A session id is a file-name part, so only these characters reach the mark's path.
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
// A shell command marks the turn when it runs the engine (flat or plugin install alike), or when it names
// the design system's folder and matches a write form the hooks share. Any other command only reads.
const ENGINE_COMMAND = /aidd-ui\.cjs/;
const UI_FOLDER = /aidd_docs\/ui\//;
// The mark's line for a shell command, which may have written any file: Stop then reads them all.
const ANY_FILE = "unknown";
// The hooks' state folder: one per user where the system has users, the temp dir being per user elsewhere.
const HOOKS_FOLDER = typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks";
const PLUGIN = "aidd-ui";
const OTHERS_BITS = 0o077;
const MARK_MAX_AGE_MS = 24 * 60 * 60 * 1000; // a mark no Stop consumed: its session ended without one
// What the hook tells the model after a write: it informs, and Stop requires.
const INFORM = 1;

/** Whether a project-relative file belongs to the design system or to its code. */
const isWatched = (project, file) => [UI_DIR, ...codeRoots(project)].some((prefix) => isUnder(file, prefix));

/** Whether a shell command changes the design system or runs the engine, which may. */
function marksTurn(command) {
  if (typeof command !== "string") return false;
  return ENGINE_COMMAND.test(command) || (UI_FOLDER.test(command) && isShellWrite(command));
}

/** Whether `folder` is a folder of this user's alone, created if missing: not a link, and where the
 * system has users, owned by this one and closed to others. */
function ownFolder(folder) {
  try {
    fs.mkdirSync(folder, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") return false;
  }
  const stat = fs.lstatSync(folder);
  if (!stat.isDirectory()) return false;
  return typeof process.getuid !== "function" || (stat.uid === process.getuid() && (stat.mode & OTHERS_BITS) === 0);
}

/** `<tmpdir>/aidd-hooks-<uid>/aidd-ui`, or null when either folder is not this user's alone. */
function stateFolder() {
  const hooks = path.join(os.tmpdir(), HOOKS_FOLDER);
  const plugin = path.join(hooks, PLUGIN);
  try {
    return ownFolder(hooks) && ownFolder(plugin) ? plugin : null;
  } catch {
    return null;
  }
}

/** The mark a turn leaves for its Stop: one file per session in the state folder, a line per
 * watched file each write touched, `unknown` for a shell command. */
function markFile(event) {
  const { sessionId } = event;
  if (typeof sessionId !== "string" || !SAFE_SESSION_ID.test(sessionId)) return null;
  const folder = stateFolder();
  return folder && path.join(folder, sessionId);
}

/** Removes the marks older than a day, each by its own entry: a link is removed, never followed. */
function sweepMarks() {
  const folder = stateFolder();
  if (!folder) return;
  for (const name of fs.readdirSync(folder)) {
    const entry = path.join(folder, name);
    try {
      const stat = fs.lstatSync(entry);
      if (!stat.isDirectory() && Date.now() - stat.mtimeMs > MARK_MAX_AGE_MS) fs.unlinkSync(entry);
    } catch {
      // gone meanwhile, or not ours to remove
    }
  }
}

/** The mark's lines; none when it is missing. A link planted at its path can only change which
 * errors Stop reports, never what the hook writes, so it is read like the mark. */
function markLines(mark) {
  try {
    return fs.readFileSync(mark, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** Adds `lines` to the mark by writing a new file beside it, created only where nothing exists,
 * then renaming it over the mark: a rename replaces a link planted at the mark's path instead of
 * writing through it, on every system. A mark that cannot be written never costs the write its
 * feedback. */
function leaveMark(mark, lines) {
  const next = `${mark}.${process.pid}`;
  try {
    fs.writeFileSync(next, [...markLines(mark), ...lines].map((line) => `${line}\n`).join(""), { flag: "wx", mode: 0o600 });
    fs.renameSync(next, mark);
  } catch {
    fs.rmSync(next, { force: true }); // no writable temp dir, or a file left at the new file's path
  }
}

/** Marks the turn for its Stop with `lines`. */
function markTurn(event, lines) {
  const mark = markFile(event);
  if (mark) leaveMark(mark, lines);
}

/** A text's lines, trimmed, the empty ones left out. */
const linesOf = (text) => (text ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

/** The lines a write added or changed: the whole lines of `written` left once those of `replaced`
 * are taken out, each as many times as it appears. Null when they are unknown: the host said
 * nothing of the text, or the write only removed lines. */
function changedLines({ written, replaced }) {
  if (typeof written !== "string") return null;
  const left = new Map();
  for (const line of linesOf(replaced)) left.set(line, (left.get(line) ?? 0) + 1);
  const changed = new Set();
  for (const line of linesOf(written)) {
    if ((left.get(line) ?? 0) > 0) left.set(line, left.get(line) - 1);
    else changed.add(line);
  }
  return changed.size === 0 && linesOf(replaced).length > 0 ? null : changed;
}

/** The 1-based lines of a file equal, once trimmed, to a changed line: every copy raises the same
 * errors. Null when the file cannot be read: its errors then say so, grouped. */
function touchedLines(file, changed) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const touched = new Set();
  for (const [index, line] of text.split(/\r?\n/u).entries()) if (changed.has(line.trim())) touched.add(index + 1);
  return touched;
}

/** Whether a path names an entry, a link to nothing included: that one is unreadable, not deleted. */
function entryExists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

/** Marks the turn, then hands the model what the write itself produced (rule 3 of the hooks'
 * contract): the errors on the lines it added or changed, one by one, then those lines' warnings.
 * A file whose changed lines are unknown has its errors grouped under its name. What the write
 * reached in other files, and a file it deleted, are Stop's to name. */
function afterWrite(project, event) {
  const written = event.files
    .map((file) => ({ ...file, file: relative(project.root, path.resolve(project.root, file.path)) }))
    .filter(({ file }) => isWatched(project, file));
  if (!written.length) return EXIT_SILENT;
  // A file the tool deleted leaves nothing to tell what cited it: Stop then reaches every other error.
  const deleted = written.some(({ file }) => !entryExists(path.join(project.root, file)));
  const lines = written.map(({ file }) => file);
  markTurn(event, deleted ? [...lines, ANY_FILE] : lines);
  const problems = problemsOf(project);
  const findings = { errors: [], reached: [], warnings: [] };
  for (const entry of written) {
    const changed = changedLines(entry);
    const touched = changed && touchedLines(path.join(project.root, entry.file), changed);
    for (const problem of problems.filter(({ file }) => file === entry.file)) {
      const finding = findingOf(problem);
      if (touched && finding.line !== undefined && !touched.has(finding.line)) continue;
      if (!isError(problem)) findings.warnings.push(finding);
      else (touched ? findings.errors : findings.reached).push(finding);
    }
  }
  const text = formatFindings(PLUGIN, findings);
  if (text) answer({ level: INFORM, text });
  return EXIT_SILENT;
}

/** The mark's lines when this Stop ends a turn that wrote a watched file and was not itself
 * forced, else null: consumes the mark either way, so the next turn starts clean. */
function consumeMark(event) {
  const mark = markFile(event);
  if (!mark || !fs.existsSync(mark)) return null;
  const lines = markLines(mark);
  fs.rmSync(mark, { force: true });
  return event.stopActive ? null : lines;
}

/** Blocks the turn's end once while a marked turn still leaves errors: those of the files it
 * listed, then those of what they reach. A shell command, or a mark without lines, leaves nothing
 * to scope by: every other error is then reached. */
function atStop(project, marked) {
  const files = marked.filter((line) => line !== ANY_FILE);
  const unknown = !files.length || marked.includes(ANY_FILE);
  const scope = unknown ? null : reached(project, files);
  const errors = problemsOf(project).filter(isError);
  const reason = formatFindings(PLUGIN, {
    errors: errors.filter((problem) => files.includes(problem.file)).map(findingOf),
    reached: errors.filter((problem) => !files.includes(problem.file) && (!scope || scope.has(problem.file))).map(findingOf),
  });
  if (reason) continueTurn(reason);
  return EXIT_SILENT;
}

function run() {
  const event = readEvent();
  if (!event) return EXIT_SILENT;
  // Session start reports nothing, the project's standing errors being no finding of the session.
  if (event.event === SESSION_START) {
    sweepMarks();
    return EXIT_SILENT;
  }
  // A shell command marks the turn or does nothing, and an ignored tool does nothing: neither reads the project.
  if (event.event === POST_TOOL_USE && !event.files.length) {
    if (marksTurn(event.command)) markTurn(event, [ANY_FILE]);
    return EXIT_SILENT;
  }
  // Stop fires on every turn: one that wrote no watched file costs no read of the project.
  const marked = event.event === STOP ? consumeMark(event) : null;
  if (event.event === STOP && marked === null) return EXIT_SILENT;
  const project = load(event.cwd);
  if (project === null) return EXIT_SILENT;
  if (event.event === POST_TOOL_USE) return afterWrite(project, event);
  return atStop(project, marked);
}

try {
  process.exitCode = run();
} catch {
  process.exitCode = EXIT_SILENT;
}
