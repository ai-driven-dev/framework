// The engine's `hook` command: runs the design system checks after a write and at Stop, handing the
// same short text to every host through its adapter; at session start it sweeps old turn state and
// notes the errors the project holds.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load, relative, isUnder, UI_DIR } = require("./project.cjs");
const { codeRoots } = require("./code.cjs");
const { problemsOf, findingOf, isError } = require("../aidd-ui.cjs");
const { isShellWrite, formatFindings } = require("./common-rules.cjs");
const { readEvent, answer, continueTurn } = require("./host.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const STOP = "Stop";
const EXIT_SILENT = 0;
// A session id is a file-name part, so only these characters reach the state's paths.
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
// A shell command marks the turn when it runs one of the engine's writing commands (flat or plugin install
// alike), or when it names the design system's folder and matches a write form the hooks share. Any other
// command only reads: `validate`, `impact`, and `publish` given ids, which validates them.
const ENGINE_RUN = /aidd-ui\.cjs["']?\s+(\w+)([^;&|\n]*)/g;
const ENGINE_WRITES = new Set(["tokens", "extract", "bump", "keep"]);
const PUBLISH_OPTIONS = /\s--breaking\b|\s--root\s+\S+/g;
const UI_FOLDER = /aidd_docs\/ui\//;
// The hooks' state folder: one per user where the system has users, the temp dir being per user elsewhere.
const HOOKS_FOLDER = typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks";
const PLUGIN = "aidd-ui";
const OTHERS_BITS = 0o077;
const STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // state no Stop or session start renewed: its session ended
// The errors the project held at the session's start or at the last turn's end, beside the turn's mark.
const BASELINE_SUFFIX = ".base";
// What the hook tells the model after a write: it informs, and Stop requires.
const INFORM = 1;

/** Whether a project-relative file belongs to the design system or to its code. */
const isWatched = (project, file) => [UI_DIR, ...codeRoots(project)].some((prefix) => isUnder(file, prefix));
/** Whether a project-relative file is code: the checks read its text only once the session wrote it. */
const isCode = (project, file) => codeRoots(project).some((prefix) => isUnder(file, prefix));

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

/** The mark a turn leaves for its Stop, one file per session in the state folder; its baseline sits
 * beside it. Null when the session cannot be told apart. */
function markFile(event) {
  const { sessionId } = event;
  if (typeof sessionId !== "string" || !SAFE_SESSION_ID.test(sessionId)) return null;
  const folder = stateFolder();
  return folder && path.join(folder, sessionId);
}

/** Removes the state older than a day, each by its own entry: a link is removed, never followed. */
function sweepState() {
  const folder = stateFolder();
  if (!folder) return;
  for (const name of fs.readdirSync(folder)) {
    const entry = path.join(folder, name);
    try {
      const stat = fs.lstatSync(entry);
      if (!stat.isDirectory() && Date.now() - stat.mtimeMs > STATE_MAX_AGE_MS) fs.unlinkSync(entry);
    } catch {
      // gone meanwhile, or not ours to remove
    }
  }
}

/** A state file's `[key, count]` pairs; null when it is missing or unreadable as pairs. A link planted
 * at its path can only change what the hook says, never what it writes, so it is read like the file. */
function readPairs(file) {
  try {
    return new Map(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Writes `pairs` by writing a new file beside `file`, created only where nothing exists, then renaming
 * it over: a rename replaces a link planted at the path instead of writing through it, on every system.
 * State that cannot be written never costs the write its feedback. */
function writePairs(file, pairs) {
  const next = `${file}.${process.pid}`;
  try {
    fs.writeFileSync(next, JSON.stringify([...pairs]), { flag: "wx", mode: 0o600 });
    fs.renameSync(next, file);
  } catch {
    fs.rmSync(next, { force: true }); // no writable temp dir, or a file left at the new file's path
  }
}

/** An error's identity across writes: its file, rule and excerpt, never its line, which moves. */
const keyOf = ({ file, rule, excerpt }) => JSON.stringify([file, rule, excerpt ?? ""]);
/** A changed line's identity: its file and its trimmed text. */
const lineKey = (file, line) => JSON.stringify([file, line]);

/** The errors past those the baseline counts, key by key: the ones nothing proves were there before. */
function newErrors(errors, baseline) {
  const left = new Map(baseline);
  return errors.filter((problem) => {
    const before = left.get(keyOf(problem)) ?? 0;
    left.set(keyOf(problem), before - 1);
    return before <= 0;
  });
}

const countKeys = (problems) => problems.reduce((counts, problem) => counts.set(keyOf(problem), (counts.get(keyOf(problem)) ?? 0) + 1), new Map());

/** The baseline: the errors the project held at the session's start or at the last turn's end. */
const readBaseline = (mark) => (mark ? readPairs(`${mark}${BASELINE_SUFFIX}`) : null);

/** The code files the baseline read, each under a key of its name alone: the checks read no other's
 * text, so the cost of a hook run follows what the session wrote, not the size of the code. */
const readCode = (baseline) => new Set([...(baseline ?? new Map()).keys()].map((key) => JSON.parse(key)).filter((key) => key.length === 1).map(([file]) => file));

/** Leaves the baseline: the errors as they stand, and the code files `scope` names, whose text was read. */
function leaveBaseline(mark, problems, scope) {
  if (!mark) return;
  const counts = countKeys(problems);
  for (const file of scope) counts.set(JSON.stringify([file]), 1);
  writePairs(`${mark}${BASELINE_SUFFIX}`, counts);
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

/** Adds a write to the turn's net changed lines: its written lines in, its replaced lines out, so a
 * line changed and changed back nets to nothing. A write that says nothing of what it replaced proves
 * a line new only against a baseline that read the file; without one it adds nothing, and nothing of
 * it is required. */
function addToNet(net, { file, written, replaced }, known) {
  if (typeof written !== "string" || (typeof replaced !== "string" && !known)) return;
  for (const line of linesOf(written)) net.set(lineKey(file, line), (net.get(lineKey(file, line)) ?? 0) + 1);
  for (const line of linesOf(replaced)) net.set(lineKey(file, line), (net.get(lineKey(file, line)) ?? 0) - 1);
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

/** The turn's state for its Stop: the mark holds its net changed lines, and the errors elsewhere it
 * was already told of, so they are told once. */
function readTurn(mark) {
  const pairs = (mark && readPairs(mark)) ?? new Map();
  const net = new Map();
  const told = new Map();
  const code = new Set();
  for (const [key, count] of pairs) {
    const [kind, rest] = [key[0], key.slice(1)];
    if (kind === "+") net.set(rest, count);
    else if (kind === "!") told.set(rest, count);
    else if (kind === "*") code.add(rest);
  }
  return { net, told, code };
}

function leaveTurn(mark, { net, told, code }) {
  if (mark) writePairs(mark, [...[...net].map(([key, count]) => [`+${key}`, count]), ...[...told].map(([key, count]) => [`!${key}`, count]), ...[...code].map((file) => [`*${file}`, 1])]);
}

/** The errors outside `files` that no baseline counts and the turn was not yet told of; they join
 * what it was told. None without a baseline: nothing then proves an error new. */
function tellOnce(problems, files, baseline, told) {
  if (!baseline) return [];
  const fresh = newErrors(problems.filter((problem) => isError(problem) && !files.includes(problem.file)), baseline);
  const untold = newErrors(fresh, told);
  for (const [key, count] of countKeys(untold)) told.set(key, (told.get(key) ?? 0) + count);
  return untold;
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
  const mark = markFile(event);
  const baseline = readBaseline(mark);
  const turn = readTurn(mark);
  const read = readCode(baseline);
  for (const entry of written) addToNet(turn.net, entry, baseline && (!isCode(project, entry.file) || read.has(entry.file)));
  for (const { file } of written) if (isCode(project, file)) turn.code.add(file);
  project.scope = new Set([...read, ...turn.code]);
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
  const files = written.map(({ file }) => file);
  findings.reached.push(...tellOnce(problems, files, baseline, turn.told).map(findingOf));
  leaveTurn(mark, turn);
  const text = formatFindings(PLUGIN, findings);
  if (text) answer({ level: INFORM, text });
  return EXIT_SILENT;
}

/** The turn's mark, consumed so the next turn starts clean; null when the turn wrote nothing watched. */
function consumeMark(mark) {
  if (!mark || !fs.existsSync(mark)) return null;
  const turn = readTurn(mark);
  fs.rmSync(mark, { force: true });
  return turn;
}

/** Holds the turn's end once on the errors it produced: those on the lines its writes changed, net,
 * and, when a baseline exists, past what it counts. Nothing else is ever required, no line being
 * proof of nothing. The baseline then takes the project's errors as they stand, so what was asked
 * once is never asked again. */
function atStop(project, mark, turn) {
  const baseline = readBaseline(mark);
  project.scope = new Set([...readCode(baseline), ...turn.code]);
  const problems = problemsOf(project);
  const changed = new Map();
  for (const [key, count] of turn.net) {
    if (count <= 0) continue;
    const [file, line] = JSON.parse(key);
    changed.set(file, (changed.get(file) ?? new Set()).add(line));
  }
  const candidates = [];
  for (const [file, lines] of changed) {
    const touched = touchedLines(path.join(project.root, file), lines);
    if (!touched) continue;
    candidates.push(...problems.filter((problem) => problem.file === file && isError(problem) && touched.has(findingOf(problem).line)));
  }
  const required = baseline ? newErrors(candidates, baseline) : candidates;
  leaveBaseline(mark, problems, project.scope);
  const reason = formatFindings(PLUGIN, { errors: required.map(findingOf) });
  if (reason) continueTurn(reason);
  return EXIT_SILENT;
}

/** Answers one host event; any failure answers nothing. */
function run() {
  const event = readEvent();
  if (!event) return EXIT_SILENT;
  if (event.event === SESSION_START) {
    sweepState();
    const project = load(event.cwd);
    if (project !== null) leaveBaseline(markFile(event), problemsOf(Object.assign(project, { scope: new Set() })), []);
    return EXIT_SILENT;
  }
  // A shell command that only reads, and an ignored tool, do nothing: neither reads the project.
  if (event.event === POST_TOOL_USE && !event.files.length && !marksTurn(event.command)) return EXIT_SILENT;
  // Stop fires on every turn: one that wrote no watched file costs no read of the project.
  const mark = markFile(event);
  const turn = event.event === STOP ? consumeMark(mark) : null;
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
