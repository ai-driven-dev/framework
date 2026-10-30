// PostToolUse and SessionStart: runs the design system checks. After a write under
// aidd_docs/ui/ or a code root, problems go back to the agent with exit 2: on stderr, which
// Claude Code and Codex read, and as additionalContext on stdout, the only channel Copilot
// reads. At session start they are printed as context. A file that cannot be read is one
// problem; anything else unexpected exits 0 in silence, so a broken check never blocks a session.
const fs = require("node:fs");
const path = require("node:path");
const { load, relative, isUnder, UI_DIR } = require("./lib/project.cjs");
const { codeRoots } = require("./lib/code.cjs");
const { problemsOf, format } = require("./validate-ui.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const EXIT_SILENT = 0;
const EXIT_BLOCKING = 2;
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

function afterWrite(project, payload) {
  if (!writtenFiles(payload.tool_input).some((file) => isWatched(project, file))) return EXIT_SILENT;
  const problems = problemsOf(project);
  if (!problems.length) return EXIT_SILENT;
  const text = format(problems).join("\n");
  process.stderr.write(`${text}\n`);
  process.stdout.write(JSON.stringify({ additionalContext: text }));
  return EXIT_BLOCKING;
}

function atSessionStart(project) {
  const problems = problemsOf(project);
  if (problems.length) process.stdout.write(`aidd-ui: ${problems.length} problems\n${format(problems).join("\n")}\n`);
  return EXIT_SILENT;
}

function run() {
  const payload = readPayload();
  if (payload === null) return EXIT_SILENT;
  const project = load(typeof payload.cwd === "string" ? payload.cwd : process.cwd());
  if (project === null) return EXIT_SILENT;
  if (payload.hook_event_name === POST_TOOL_USE) return afterWrite(project, payload);
  if (payload.hook_event_name === SESSION_START) return atSessionStart(project);
  return EXIT_SILENT;
}

try {
  process.exitCode = run();
} catch {
  process.exitCode = EXIT_SILENT;
}
