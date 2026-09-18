#!/usr/bin/env node

/**
 * PreToolUse guard: refuses a Write, Edit or MultiEdit that would leave a plugin's dispatch
 * surface breaking one of the two architecture rules of issue #250. The rules live in
 * `scripts/lib/architecture-rules.js`; this script only supplies their inputs and speaks the
 * host's refusal.
 *
 * It fails open at every step. This hook gates every write in the repository, so an unreadable
 * payload, an unknown tool, an edit it cannot reconstruct or a crash must let the write through
 * rather than halt unrelated work.
 */

const fs = require("node:fs");
const path = require("node:path");

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const PROCEED = 0;

const CITATION_SHAPES =
  "a cell under a table header that reads Action, a fenced `actions/<name>.md` path, or a " +
  "backticked `<name>.md` file name — a word in prose does not count";

function architectureRules() {
  try {
    return require(path.resolve(__dirname, "..", "..", "scripts", "lib", "architecture-rules.js"));
  } catch {
    return null;
  }
}

function payloadFromStdin() {
  try {
    const parsed = JSON.parse(fs.readFileSync(0, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function repoRelative(absolutePath, root) {
  const relative = path.relative(root, absolutePath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join("/");
}

function readFile(absolutePath) {
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Splices literally. `String.prototype.replace` reads `$&`, `` $` ``, `$'` and `$1` in its
 * replacement even when the pattern is a plain string, which corrupts a `new_string` holding one.
 */
function spliced(content, { old_string: oldString, new_string: newString, replace_all: replaceAll }) {
  if (typeof oldString !== "string" || typeof newString !== "string") return null;
  if (!content.includes(oldString)) return null;
  if (replaceAll) return content.split(oldString).join(newString);

  const at = content.indexOf(oldString);
  return content.slice(0, at) + newString + content.slice(at + oldString.length);
}

function editedContent(absolutePath, edits) {
  let content = readFile(absolutePath);
  if (content === null) return null;

  for (const edit of edits) {
    if (!edit || typeof edit !== "object") return null;
    content = spliced(content, edit);
    if (content === null) return null;
  }
  return content;
}

/** What the file will hold if this call goes through, or null when that cannot be determined. */
function prospectiveContent(toolName, toolInput, absolutePath) {
  if (toolName === "Write") {
    return typeof toolInput.content === "string" ? toolInput.content : null;
  }
  if (toolName === "Edit") return editedContent(absolutePath, [toolInput]);

  const { edits } = toolInput;
  if (!Array.isArray(edits) || edits.length === 0) return null;
  return editedContent(absolutePath, edits);
}

/** Rule two needs the skill's action files; the engine never reads them itself. */
function actionFileNames(relativePath, absolutePath) {
  if (path.basename(relativePath) !== "SKILL.md") return undefined;
  try {
    return fs.readdirSync(path.join(path.dirname(absolutePath), "actions")).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
}

function howToFix({ rule, plugin }) {
  return rule === "orthogonality"
    ? `name the concept ${plugin} owns instead of addressing it directly`
    : `cite every action file the skill provides in its "## Actions" section. A citation is ${CITATION_SHAPES}`;
}

function refuse(violations) {
  const reason = violations.map((v) => `${v.message}. Fix: ${howToFix(v)}.`).join("\n");
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
}

function violationsFor(engine, relativePath, content, actions) {
  try {
    const found = engine.checkArchitecture(relativePath, content, actions);
    return Array.isArray(found) ? found : [];
  } catch {
    return [];
  }
}

function main() {
  const engine = architectureRules();
  const payload = payloadFromStdin();
  if (!engine || !payload) return PROCEED;

  const { tool_name: toolName, tool_input: toolInput } = payload;
  if (!WRITE_TOOLS.has(toolName)) return PROCEED;
  if (!toolInput || typeof toolInput.file_path !== "string" || toolInput.file_path === "") return PROCEED;

  // Resolved against the project root, never the process cwd: the two can differ, and a readdir
  // against the wrong one comes back empty instead of failing.
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const absolutePath = path.resolve(root, toolInput.file_path);
  const relativePath = repoRelative(absolutePath, root);
  if (!relativePath || !engine.classifyFile(relativePath)) return PROCEED;

  const content = prospectiveContent(toolName, toolInput, absolutePath);
  if (content === null) return PROCEED;

  const violations = violationsFor(engine, relativePath, content, actionFileNames(relativePath, absolutePath));
  if (violations.length > 0) refuse(violations);

  return PROCEED;
}

try {
  process.exitCode = main();
} catch {
  process.exitCode = PROCEED;
}
