// After a write, hands the problems of the memory file it reached back to the model as context.
// It informs and never blocks: any failure, and any write outside the bank, exits 0 in silence.
const fs = require("node:fs");
const path = require("node:path");
const { lintFile } = require("./memory-lint.js");

const MEMORY_DIR = path.join("aidd_docs", "memory");
const EXCLUDED_FILE = "README.md";
const LIMIT = 10; // problem lines the hook prints; the engine by hand prints them all
const ENGINE = path.join(__dirname, "memory-lint.js");
// Codex's apply_patch passes its patch as tool_input.command, Copilot's Edit as tool_input itself.
const PATCHED_FILE = /^\*\*\* (?:Add|Update) File: (.+)$/gm;

/** The JSON on stdin, or null when it is none. */
function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

/** The files a write tool touched: Claude Code and Copilot name one, a patch one per header line. */
function writtenFiles(toolInput) {
  if (typeof toolInput?.file_path === "string") return [toolInput.file_path];
  if (typeof toolInput?.path === "string") return [toolInput.path];
  const patch = typeof toolInput === "string" ? toolInput : toolInput?.command;
  if (typeof patch !== "string") return [];
  return [...patch.matchAll(PATCHED_FILE)].map((match) => match[1]);
}

/** Cursor sends no cwd on a Write, so its first workspace root stands in. */
function projectRoot(payload) {
  const candidates = [payload.cwd, payload.workspace_roots?.[0], process.env.CURSOR_PROJECT_DIR, process.env.CLAUDE_PROJECT_DIR];
  return candidates.find((value) => typeof value === "string" && value !== "") ?? process.cwd();
}

/** Copilot's payload carries tool_result where Claude Code and Codex carry tool_response. */
function isCopilot(payload) {
  return "tool_result" in payload && !("tool_response" in payload);
}

/** Whether a file is a `.md` directly under the bank, other than its README. */
function isMemoryFile(root, file) {
  const relative = path.relative(root, file);
  return path.dirname(relative) === MEMORY_DIR && file.endsWith(".md") && path.basename(file) !== EXCLUDED_FILE;
}

const errorsFirst = (problems) => [...problems.filter(({ severity }) => severity === "error"), ...problems.filter(({ severity }) => severity !== "error")];

function line({ file, line: at, rule, severity, message }) {
  return `${severity === "error" ? "✗" : "⚠"} ${file}:${at}: ${message} (${rule})`;
}

function run() {
  const payload = readPayload();
  if (payload === null || typeof payload !== "object") return;
  const written = writtenFiles(payload.tool_input);
  if (!written.length) return;
  const root = path.resolve(projectRoot(payload));
  const files = [...new Set(written.map((file) => path.resolve(root, file)))].filter((file) => isMemoryFile(root, file));
  if (!files.length) return;
  const problems = errorsFirst(files.flatMap((file) => lintFile(root, file)));
  if (!problems.length) return;
  const rest = problems.length - LIMIT;
  const text = [...problems.slice(0, LIMIT).map(line), ...(rest > 0 ? [`… and ${rest} more: node ${ENGINE} ${root}`] : [])].join("\n");
  // Each host reads one key: Copilot the top level, Claude Code, Codex and Cursor hookSpecificOutput.
  const output = isCopilot(payload)
    ? { additionalContext: text }
    : { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } };
  process.stdout.write(JSON.stringify(output));
}

try {
  run();
} catch {
  // a broken check never blocks a write
}
process.exitCode = 0;
