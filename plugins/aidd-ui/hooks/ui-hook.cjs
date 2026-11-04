// Runs the design system checks after a write, at Stop and at session start, printing the same short text on every host.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load, relative, isUnder, UI_DIR } = require("./lib/project.cjs");
const { codeRoots } = require("./lib/code.cjs");
const { reached } = require("./lib/graph.cjs");
const { problemsOf, format, isError } = require("./aidd-ui.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const STOP = "Stop";
// Cursor names its events in camelCase.
const EVENTS = { PostToolUse: POST_TOOL_USE, postToolUse: POST_TOOL_USE, SessionStart: SESSION_START, sessionStart: SESSION_START, Stop: STOP, stop: STOP };
const EXIT_SILENT = 0;
const LIMIT = 10; // problem lines after a write and at Stop; the validator by hand prints them all
const START_LIMIT = 5; // error lines at session start
const ENGINE = path.join(__dirname, "aidd-ui.cjs");
// A session id is a file-name part, so only these characters reach the mark's path.
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
// Codex's apply_patch passes its patch as tool_input.command, Copilot's Edit as tool_input itself.
const PATCHED_FILE = /^\*\*\* (?:Add|Update) File: (.+)$/gm;
// A shell command marks the turn when it runs the engine (flat or plugin install alike), or when it names
// the design system's folder together with one of these writes. Any other command only reads.
const ENGINE_COMMAND = /aidd-ui\.cjs/;
const UI_FOLDER = /aidd_docs\/ui\//;
const SHELL_WRITES = [
  /(?<![\d&])>(?!&)(?!\s*\/dev\/null)/, // a redirection, not 2>&1 or >/dev/null
  /\btee\b/,
  /\bsed\b[^|;&]*\s-(?:[a-zA-Z]*i|-in-place)/,
  /(?<![\w./-])(?:mv|cp|rm|touch|mkdir|patch|apply_patch)(?![\w./-])/,
  /\bgit\s+(?:apply|checkout|restore)\b/,
];
// Cursor sends every tool to the hook, and a Read carries file_path like a Write: only these two count.
const CURSOR_TOOLS = { Write: "write", Shell: "shell" };
// The mark's line for a shell command, which may have written any file: Stop then reads them all.
const ANY_FILE = "*";
// A link planted at the mark's path is never followed, on a platform that can refuse one.
const NO_FOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const APPEND_FLAGS = fs.constants.O_WRONLY | fs.constants.O_APPEND | NO_FOLLOW;
const READ_FLAGS = fs.constants.O_RDONLY | NO_FOLLOW;

/** The JSON on stdin, or null when it is none. */
function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

/** Whether a project-relative file belongs to the design system or to its code. */
const isWatched = (project, file) => [UI_DIR, ...codeRoots(project)].some((prefix) => isUnder(file, prefix));

/** The text a tool ran: a patch or a shell command, as a string or as `command`. */
const commandOf = (toolInput) => (typeof toolInput === "string" ? toolInput : toolInput?.command);

/** The files a write tool touched: Claude Code and Copilot name one, a patch one per header line. */
function writtenFiles(toolInput) {
  if (typeof toolInput?.file_path === "string") return [toolInput.file_path];
  if (typeof toolInput?.path === "string") return [toolInput.path];
  const patch = commandOf(toolInput);
  if (typeof patch !== "string") return [];
  return [...patch.matchAll(PATCHED_FILE)].map((match) => match[1]);
}

/** Whether a shell command changes the design system or runs the engine, which may. */
function marksTurn(command) {
  if (typeof command !== "string") return false;
  return ENGINE_COMMAND.test(command) || (UI_FOLDER.test(command) && SHELL_WRITES.some((write) => write.test(command)));
}

/** Cursor sends cursor_version on every payload, as no other host does. */
const isCursor = (payload) => "cursor_version" in payload;

/** What a tool did: "write", "shell", or null for a tool the hook ignores. Cursor names its tools;
 * the other hosts are told apart by the files the input names. */
function toolKind(payload) {
  if (isCursor(payload)) return CURSOR_TOOLS[payload.tool_name] ?? null;
  return writtenFiles(payload.tool_input).length ? "write" : "shell";
}

/** What identifies the turn's session: Cursor's conversation_id, which its documentation lists on every event, else session_id. */
const sessionOf = (payload) => (isCursor(payload) ? payload.conversation_id : payload.session_id);

/** The mark a turn leaves for its Stop: one file per session, in the OS temp dir, a line per
 * watched file each write touched, `*` for a shell command. */
function markFile(payload) {
  const sessionId = sessionOf(payload);
  if (typeof sessionId !== "string" || !SAFE_SESSION_ID.test(sessionId)) return null;
  return path.join(os.tmpdir(), `aidd-ui-turn-${sessionId}`);
}

/** Creates the mark only where nothing exists, then appends `lines` to it, never through a link.
 * The mark serves Stop alone: a mark that cannot be written never costs the write its feedback. */
function leaveMark(mark, lines) {
  try {
    fs.writeFileSync(mark, "", { flag: "wx", mode: 0o600 });
  } catch {
    // already marked this turn, or no writable temp dir
  }
  let descriptor;
  try {
    descriptor = fs.openSync(mark, APPEND_FLAGS);
    fs.writeSync(descriptor, lines.map((line) => `${line}\n`).join(""));
  } catch {
    // a link planted at its path, or no writable temp dir
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

/** Marks the turn for its Stop with `lines`. */
function markTurn(payload, lines) {
  const mark = markFile(payload);
  if (mark) leaveMark(mark, lines);
}

/** The mark's lines; none when it cannot be read, as a planted link cannot. */
function markLines(mark) {
  let descriptor;
  try {
    descriptor = fs.openSync(mark, READ_FLAGS);
    return fs.readFileSync(descriptor, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

/** Copilot's payload carries tool_result where Claude Code and Codex carry tool_response. */
function isCopilot(payload) {
  return "tool_result" in payload && !("tool_response" in payload);
}

const errorsOf = (problems) => problems.filter(isError);

/** The command that prints every problem: the engine relative to the project when it sits under
 * it, and the project root only when the hook did not run in it. */
function validateCommand(project) {
  const engine = relative(project.root, ENGINE);
  const shown = engine.startsWith("../") || path.isAbsolute(engine) ? ENGINE : engine;
  return `node ${shown} validate${path.resolve(project.root) === process.cwd() ? "" : ` ${project.root}`}`;
}

/** At most `limit` lines of problems, errors first so the cap never cuts an error for a warning,
 * then one line counting the `total` errors it leaves out and how to see them. */
function lean(project, problems, limit, total) {
  const shown = problems.slice(0, limit);
  const left = total - errorsOf(shown).length;
  return [...format(shown), ...(left > 0 ? [`+${left} more: ${validateCommand(project)}`] : [])];
}

/** Marks the turn, then hands the model what the write broke: the errors of the written files and
 * of what they reach, the warnings of the written files; nothing when there are none. */
function afterWrite(project, payload) {
  const written = writtenFiles(payload.tool_input)
    .map((file) => relative(project.root, path.resolve(project.root, file)))
    .filter((file) => isWatched(project, file));
  if (!written.length) return EXIT_SILENT;
  markTurn(payload, written);
  const problems = problemsOf(project);
  const scope = reached(project, written);
  const errors = errorsOf(problems);
  const shown = [...errors.filter((problem) => !scope || scope.has(problem.file)), ...problems.filter((problem) => !isError(problem) && written.includes(problem.file))];
  if (!shown.length) return EXIT_SILENT;
  const text = lean(project, shown, LIMIT, errors.length).join("\n");
  // Each host reads one key: Cursor additional_context, Copilot additionalContext, Claude Code and Codex hookSpecificOutput.
  let output = { hookSpecificOutput: { hookEventName: POST_TOOL_USE, additionalContext: text } };
  if (isCursor(payload)) output = { additional_context: text };
  else if (isCopilot(payload)) output = { additionalContext: text };
  process.stdout.write(JSON.stringify(output));
  return EXIT_SILENT;
}

/** The mark's lines when this Stop ends a turn that wrote a watched file and was not itself
 * forced, else null: consumes the mark either way, so the next turn starts clean. */
function consumeMark(payload) {
  const mark = markFile(payload);
  if (!mark || !fs.existsSync(mark)) return null;
  const lines = markLines(mark);
  fs.rmSync(mark, { force: true });
  // Cursor counts the follow-ups a Stop already caused in loop_count; the others flag the forced one.
  return (isCursor(payload) ? payload.loop_count === 0 : payload.stop_hook_active !== true) ? lines : null;
}

/** Blocks the turn's end once while a marked turn still leaves errors in what it reached: the
 * written files and what they reach, as after a write, or every file once a shell command, or a
 * mark without lines, leaves nothing to scope by. */
function atStop(project, payload, marked) {
  const files = marked.includes(ANY_FILE) ? [] : marked;
  const scope = files.length ? reached(project, files) : null;
  const errors = errorsOf(problemsOf(project)).filter((problem) => !scope || scope.has(problem.file));
  if (!errors.length) return EXIT_SILENT;
  const reason = lean(project, errors, LIMIT, errors.length).join("\n");
  process.stdout.write(JSON.stringify(isCursor(payload) ? { followup_message: reason } : { decision: "block", reason }));
  return EXIT_SILENT;
}

function atSessionStart(project, payload) {
  const errors = errorsOf(problemsOf(project));
  if (!errors.length) return EXIT_SILENT;
  const text = [`aidd-ui: ${errors.length} errors`, ...format(errors.slice(0, START_LIMIT))].join("\n");
  process.stdout.write(isCursor(payload) ? JSON.stringify({ additional_context: text }) : `${text}\n`);
  return EXIT_SILENT;
}

/** The directory the host works in: Claude Code, Codex and Copilot send cwd, Cursor its first workspace root. */
function rootOf(payload) {
  if (typeof payload.cwd === "string") return payload.cwd;
  const [first] = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
  return typeof first === "string" ? first : process.cwd();
}

function run() {
  const payload = readPayload();
  const event = EVENTS[payload?.hook_event_name];
  if (!event) return EXIT_SILENT;
  // A shell command marks the turn or does nothing, and an ignored tool does nothing: neither reads the project.
  if (event === POST_TOOL_USE) {
    const kind = toolKind(payload);
    if (kind !== "write") {
      if (kind === "shell" && marksTurn(commandOf(payload.tool_input))) markTurn(payload, [ANY_FILE]);
      return EXIT_SILENT;
    }
  }
  // Stop fires on every turn: one that wrote no watched file costs no read of the project.
  const marked = event === STOP ? consumeMark(payload) : null;
  if (event === STOP && marked === null) return EXIT_SILENT;
  const project = load(rootOf(payload));
  if (project === null) return EXIT_SILENT;
  if (event === POST_TOOL_USE) return afterWrite(project, payload);
  if (event === SESSION_START) return atSessionStart(project, payload);
  return atStop(project, payload, marked);
}

try {
  process.exitCode = run();
} catch {
  process.exitCode = EXIT_SILENT;
}
