// After a write, hands the problems of the memory file it reached back to the model as context.
// It informs and never blocks: any failure, and any write outside the bank, exits 0 in silence.
const fs = require("node:fs");
const path = require("node:path");
const { lintFile } = require("./memory-lint.cjs");

const MEMORY_DIR = path.join("aidd_docs", "memory");
const EXCLUDED_FILE = "README.md";
const LIMIT = 5; // problem lines the hook prints; the engine by hand prints them all
// The hook fires right after a shell command ends and a model's next action is seconds away, so
// a file changed longer ago was not this command's. A shell write carries its text in the command,
// a read does not: only errors on lines the command quotes are reported (a `sed -i` or `cp` is not).
const SHELL_WINDOW_MS = 2000;
const ENGINE = path.join(__dirname, "memory-lint.cjs");
// Codex's apply_patch passes its patch as tool_input.command, Copilot's Edit as tool_input itself.
const PATCHED_FILE = /^\*\*\* (?:Add|Update) File: (.+)$/u;

/** The JSON on stdin, or null when it is none. */
function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

/** The `+` lines of each file a patch touches, as runs of consecutive added lines. */
function patchedRuns(patch) {
  const files = new Map();
  let runs = null;
  let run = null;
  for (const text of patch.split(/\r?\n/u)) {
    const header = text.match(PATCHED_FILE);
    if (header || text.startsWith("*** ")) {
      run = null;
      runs = header ? (files.get(header[1]) ?? files.set(header[1], []).get(header[1])) : null;
    } else if (runs && text.startsWith("+")) {
      if (!run) runs.push((run = []));
      run.push(text.slice(1));
    } else {
      run = null;
    }
  }
  return [...files].map(([file, found]) => ({ file, chunks: found.map((lines) => lines.join("\n")) }));
}

/**
 * What a write tool produced: each file with the text it wrote, or `chunks: null` when it wrote
 * the whole file. Claude Code and Copilot name one file, a patch one per header line.
 */
function writes(toolInput) {
  const patch = typeof toolInput === "string" ? toolInput : toolInput?.command;
  const file = [toolInput?.file_path, toolInput?.path].find((value) => typeof value === "string");
  if (file === undefined) return typeof patch === "string" ? patchedRuns(patch) : [];
  if (typeof toolInput.new_string === "string" && toolInput.content === undefined) return [{ file, chunks: [toolInput.new_string] }];
  if (Array.isArray(toolInput.edits) && toolInput.content === undefined) {
    return [{ file, chunks: toolInput.edits.map((edit) => edit?.new_string).filter((chunk) => typeof chunk === "string") }];
  }
  return [{ file, chunks: null }];
}

/** The lines of `text` where `chunk` now stands, as 1-based numbers. */
function linesOf(text, chunk) {
  const wanted = chunk.replace(/\n+$/u, "");
  if (wanted === "") return [];
  const found = [];
  for (let at = text.indexOf(wanted); at !== -1; at = text.indexOf(wanted, at + 1)) {
    const first = text.slice(0, at).split("\n").length;
    for (let offset = 0; offset < wanted.split("\n").length; offset += 1) found.push(first + offset);
  }
  return found;
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

/** One problem as one line: where, which rule, what is wrong and how to fix it. */
function line({ file, line: at, rule, message }) {
  return `${file}:${at} ${rule} ${message}`;
}

/** The command as the shell hands it on: `'\''` back to `'`, and a backslash before `` ` `` `"` `\` `$` dropped. */
function unescaped(command) {
  return command.replace(/'\\''/gu, "'").replace(/\\([`"\\$])/gu, "$1");
}

/** The errors of one written file that stand on the lines this write produced. */
function ownErrors(root, { file, chunks, quoted }) {
  const errors = lintFile(root, file).filter(({ severity }) => severity === "error");
  const text = fs.readFileSync(file, "utf8");
  if (quoted !== undefined) {
    const lines = text.split("\n");
    const sources = [quoted, unescaped(quoted)];
    return errors.filter(({ line: at }) => lines[at - 1].trim() !== "" && sources.some((source) => source.includes(lines[at - 1].trim())));
  }
  if (chunks === null) return errors;
  const written = new Set(chunks.flatMap((chunk) => linesOf(text, chunk)));
  return errors.filter(({ line: at }) => written.has(at));
}

/** The bank files a shell command that names the bank has just changed, as whole-file writes. */
function shellWrites(root, command) {
  if (!/aidd_docs[/\\]memory/u.test(command)) return;
  const dir = path.join(root, MEMORY_DIR);
  return fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((file) => isMemoryFile(root, file) && Date.now() - fs.statSync(file).mtimeMs <= SHELL_WINDOW_MS)
    .map((file) => ({ file, chunks: null, quoted: command }));
}

function run() {
  const payload = readPayload();
  if (payload === null || typeof payload !== "object") return;
  const root = path.resolve(projectRoot(payload));
  const command = typeof payload.tool_input === "string" ? payload.tool_input : payload.tool_input?.command;
  let written = writes(payload.tool_input);
  if (!written.length && typeof command === "string" && !command.includes("*** Begin Patch")) written = shellWrites(root, command) ?? [];
  if (!written.length) return;
  const targets = written.map(({ file, ...rest }) => ({ file: path.resolve(root, file), ...rest })).filter(({ file }) => isMemoryFile(root, file));
  const problems = targets.flatMap((target) => ownErrors(root, target));
  if (!problems.length) return;
  const rest = problems.length - LIMIT;
  const text = [...problems.slice(0, LIMIT).map(line), ...(rest > 0 ? [`+${rest} more: node ${ENGINE}${root === process.cwd() ? "" : ` ${root}`}`] : [])].join("\n");
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
