// Runs the design system checks at three moments, and prints the same short text on every host (Cursor's camelCase events included):
// problem lines, then at most one line counting the errors left out. After a write under
// aidd_docs/ui/ or a code root, the turn is marked and the errors of the files the write reached
// come back, with the warnings of the written files; a shell command that runs the engine or names
// aidd_docs/ui/ marks the turn and prints nothing. At Stop, a marked turn gets its errors back
// once, as the reason to keep working; warnings never block. At session start the errors are
// counted and the first few printed. A file that cannot be read is one problem; anything else
// unexpected exits 0 in silence, so a broken check never blocks a session.
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
// A shell command that runs the engine (flat or plugin install alike) or names the design system's folder.
const ENGINE_COMMAND = /aidd-ui\.cjs|aidd_docs\/ui\//;

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

/** Whether a tool ran a shell command that reaches the design system: it is no patch. */
const isEngineCommand = (toolInput) => !writtenFiles(toolInput).length && ENGINE_COMMAND.test(commandOf(toolInput) ?? "");

/** Cursor sends cursor_version on every payload, as no other host does. */
const isCursor = (payload) => "cursor_version" in payload;

/** What identifies the turn's session: Cursor's conversation_id, which its documentation lists on every event, else session_id. */
const sessionOf = (payload) => (isCursor(payload) ? payload.conversation_id : payload.session_id);

/** The mark a turn leaves for its Stop: one empty file per session, in the OS temp dir. */
function markFile(payload) {
  const sessionId = sessionOf(payload);
  if (typeof sessionId !== "string" || !SAFE_SESSION_ID.test(sessionId)) return null;
  return path.join(os.tmpdir(), `aidd-ui-turn-${sessionId}`);
}

/** Creates the mark only where nothing exists, so a link planted at its path is never followed.
 * The mark serves Stop alone: a mark already there, or one that cannot be written, never costs
 * the write its feedback. */
function leaveMark(mark) {
  try {
    fs.writeFileSync(mark, "", { flag: "wx", mode: 0o600 });
  } catch {
    // already marked this turn, or no writable temp dir
  }
}

/** Marks the turn for its Stop. */
function markTurn(payload) {
  const mark = markFile(payload);
  if (mark) leaveMark(mark);
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
  markTurn(payload);
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

/** Whether this Stop ends a turn that wrote a watched file and was not itself forced: consumes
 * the mark either way, so the next turn starts clean. */
function consumeMark(payload) {
  const mark = markFile(payload);
  if (!mark || !fs.existsSync(mark)) return false;
  fs.rmSync(mark, { force: true });
  // Cursor counts the follow-ups a Stop already caused in loop_count; the others flag the forced one.
  return isCursor(payload) ? payload.loop_count === 0 : payload.stop_hook_active !== true;
}

/** Blocks the turn's end once while a marked turn still leaves errors behind. */
function atStop(project, payload) {
  const errors = errorsOf(problemsOf(project));
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
  // A shell command reaching the design system marks the turn and costs no read of the project; any other does nothing.
  if (event === POST_TOOL_USE && isEngineCommand(payload.tool_input)) {
    markTurn(payload);
    return EXIT_SILENT;
  }
  // Stop fires on every turn: one that wrote no watched file costs no read of the project.
  if (event === STOP && !consumeMark(payload)) return EXIT_SILENT;
  const project = load(rootOf(payload));
  if (project === null) return EXIT_SILENT;
  if (event === POST_TOOL_USE) return afterWrite(project, payload);
  if (event === SESSION_START) return atSessionStart(project, payload);
  return atStop(project, payload);
}

try {
  process.exitCode = run();
} catch {
  process.exitCode = EXIT_SILENT;
}
