// PostToolUse and SessionStart: runs the design system checks. After a write under
// aidd_docs/ui/ or a code root, problems go back to the agent on stderr with exit 2; at session
// start they are printed as context. Anything unexpected exits 0 in silence: a broken check
// never blocks a session.
const fs = require("node:fs");
const path = require("node:path");
const { load, UI_DIR } = require("./lib/project.cjs");
const { codeRoots } = require("./lib/code.cjs");
const { problemsOf, format } = require("./validate-ui.cjs");

const POST_TOOL_USE = "PostToolUse";
const SESSION_START = "SessionStart";
const EXIT_SILENT = 0;
const EXIT_BLOCKING = 2; // Claude Code hands a PostToolUse hook's stderr back to the agent
const PATH_SEPARATOR = "/";

/** The JSON object on stdin, or null when there is none or it is not one. */
function readPayload() {
  try {
    const parsed = JSON.parse(fs.readFileSync(0, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether `file` lies under `prefix`, both relative to the project root. */
const isUnder = (file, prefix) => {
  const folder = prefix.replace(/\/+$/, "");
  return file === folder || file.startsWith(`${folder}${PATH_SEPARATOR}`);
};

/** Whether a written file belongs to the design system or to its code. */
function isWatched(project, filePath) {
  const file = path.relative(project.root, path.resolve(project.root, filePath)).split(path.sep).join(PATH_SEPARATOR);
  return [UI_DIR, ...codeRoots(project)].some((prefix) => isUnder(file, prefix));
}

function afterWrite(project, payload) {
  const filePath = payload.tool_input?.file_path;
  if (typeof filePath !== "string" || !isWatched(project, filePath)) return EXIT_SILENT;
  const problems = problemsOf(project);
  if (!problems.length) return EXIT_SILENT;
  process.stderr.write(`${format(problems).join("\n")}\n`);
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
