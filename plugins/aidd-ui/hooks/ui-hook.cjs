// Runs the design system checks at three moments. After a write under aidd_docs/ui/ or a code
// root, the turn is marked and the problems come back as context. At Stop, a marked turn gets
// its problems back once, as the reason to keep working. At session start they are printed as
// context. A file that cannot be read is one problem; anything else unexpected exits 0 in
// silence, so a broken check never blocks a session.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load, relative, isUnder, UI_DIR } = require("./lib/project.cjs");
const { codeRoots } = require("./lib/code.cjs");
const { problemsOf, format } = require("./validate-ui.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const STOP = "Stop";
const EXIT_SILENT = 0;
// A session id is a file-name part, so only these characters reach the mark's path.
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
// Codex's apply_patch passes its patch as tool_input.command, Copilot's Edit as tool_input itself.
const PATCHED_FILE = /^\*\*\* (?:Add|Update) File: (.+)$/gm;

/** The JSON object on stdin, or null when there is none or it is not one. */
function readPayload() {
  try {
    const parsed = JSON.parse(fs.readFileSync(0, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether a written file belongs to the design system or to its code. */
function isWatched(project, filePath) {
  const file = relative(project.root, path.resolve(project.root, filePath));
  return [UI_DIR, ...codeRoots(project)].some((prefix) => isUnder(file, prefix));
}

/** The files a write tool touched: Claude Code and Copilot name one, a patch one per header line. */
function writtenFiles(toolInput) {
  if (typeof toolInput?.file_path === "string") return [toolInput.file_path];
  if (typeof toolInput?.path === "string") return [toolInput.path];
  const patch = typeof toolInput === "string" ? toolInput : toolInput?.command;
  if (typeof patch !== "string") return [];
  return [...patch.matchAll(PATCHED_FILE)].map((match) => match[1].trim());
}

/** The mark a turn leaves for its Stop: one empty file per session, in the OS temp dir. */
function markFile(sessionId) {
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

/** Copilot's payload carries tool_result where Claude Code and Codex carry tool_response. */
function isCopilot(payload) {
  return "tool_result" in payload && !("tool_response" in payload);
}

function afterWrite(project, payload) {
  if (!writtenFiles(payload.tool_input).some((file) => isWatched(project, file))) return EXIT_SILENT;
  const mark = markFile(payload.session_id);
  if (mark) leaveMark(mark);
  const problems = problemsOf(project);
  if (!problems.length) return EXIT_SILENT;
  const text = [`aidd-ui: the write was saved, fix ${problems.length} problems:`, ...format(problems)].join("\n");
  // Each host reads one key: Copilot the top level, Claude Code and Codex hookSpecificOutput.
  const output = isCopilot(payload)
    ? { additionalContext: text }
    : { hookSpecificOutput: { hookEventName: POST_TOOL_USE, additionalContext: text } };
  process.stdout.write(JSON.stringify(output));
  return EXIT_SILENT;
}

/** Whether this Stop ends a turn that wrote a watched file and was not itself forced: consumes
 * the mark either way, so the next turn starts clean. */
function consumeMark(payload) {
  const mark = markFile(payload.session_id);
  if (!mark || !fs.existsSync(mark)) return false;
  fs.rmSync(mark, { force: true });
  return payload.stop_hook_active !== true;
}

/** Blocks the turn's end once while a marked turn still leaves problems behind. */
function atStop(project) {
  const problems = problemsOf(project);
  if (!problems.length) return EXIT_SILENT;
  const reason = [`aidd-ui: the design system has ${problems.length} problems, fix them before you finish:`, ...format(problems)].join("\n");
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  return EXIT_SILENT;
}

function atSessionStart(project) {
  const problems = problemsOf(project);
  if (problems.length) process.stdout.write(`aidd-ui: ${problems.length} problems\n${format(problems).join("\n")}\n`);
  return EXIT_SILENT;
}

function run() {
  const payload = readPayload();
  if (payload === null) return EXIT_SILENT;
  // Stop fires on every turn: one that wrote no watched file costs no read of the project.
  if (payload.hook_event_name === STOP && !consumeMark(payload)) return EXIT_SILENT;
  const project = load(typeof payload.cwd === "string" ? payload.cwd : process.cwd());
  if (project === null) return EXIT_SILENT;
  if (payload.hook_event_name === POST_TOOL_USE) return afterWrite(project, payload);
  if (payload.hook_event_name === SESSION_START) return atSessionStart(project);
  if (payload.hook_event_name === STOP) return atStop(project);
  return EXIT_SILENT;
}

try {
  process.exitCode = run();
} catch {
  process.exitCode = EXIT_SILENT;
}
