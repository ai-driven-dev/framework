#!/usr/bin/env node

/**
 * PreToolUse guard for Write, Edit and MultiEdit: refuses an AI-authored edit that would leave a plugin's
 * dispatch surface breaking one of the two named architecture rules (issue #250) — cross-plugin
 * orthogonality and router coherence. The rules themselves live in `scripts/lib/architecture-
 * rules.js`, a pure engine this script is the only caller of at write time.
 *
 * Fails open on purpose: any unrecognised shape, unparseable payload, unreconstructable edit, or
 * path outside the governed surface exits 0 with no output. This hook gates every write tool call
 * in the repository, so a crash here must never block unrelated work.
 */

const fs = require("node:fs");
const path = require("node:path");

function loadEngine() {
  try {
    // Fixed relative path: this hook always lives two levels below the repo root, at
    // `.claude/hooks/`, regardless of CLAUDE_PROJECT_DIR or the process cwd.
    return require(path.resolve(__dirname, "..", "..", "scripts", "lib", "architecture-rules.js"));
  } catch {
    return null;
  }
}

function readPayload() {
  try {
    const parsed = JSON.parse(fs.readFileSync(0, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Repository-relative, forward-slashed path, or null when it resolves outside the project. */
function toRepoRelative(filePath, root) {
  try {
    const rel = path.relative(root, path.resolve(root, filePath));
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join("/");
  } catch {
    return null;
  }
}

/** Splices `newString` in for `oldString` literally — never through `String.prototype.replace`,
 * whose replacement string treats `$&`, `` $` ``, `$'` and `$1`-style tokens specially even
 * when the search pattern is a plain string, corrupting a `new_string` that happens to contain
 * one. */
function applyEdit(current, oldString, newString, replaceAll) {
  if (typeof oldString !== "string" || typeof newString !== "string") return null;
  if (!current.includes(oldString)) return null;
  if (replaceAll) return current.split(oldString).join(newString);

  const idx = current.indexOf(oldString);
  return current.slice(0, idx) + newString + current.slice(idx + oldString.length);
}

/** The prospective file content, or null when it cannot be determined (Write with no string
 * content, an Edit whose old_string is absent, or the current file cannot be read). */
function prospectiveContent(toolName, toolInput) {
  if (toolName === "Write") {
    return typeof toolInput.content === "string" ? toolInput.content : null;
  }
  if (toolName !== "Edit" && toolName !== "MultiEdit") return null;

  let current;
  try {
    current = fs.readFileSync(toolInput.file_path, "utf8");
  } catch {
    return null;
  }

  if (toolName === "Edit") {
    return applyEdit(current, toolInput.old_string, toolInput.new_string, Boolean(toolInput.replace_all));
  }

  // MultiEdit applies its edits in order, each to the result of the one before.
  if (!Array.isArray(toolInput.edits) || toolInput.edits.length === 0) return null;
  for (const edit of toolInput.edits) {
    if (!edit || typeof edit !== "object") return null;
    current = applyEdit(current, edit.old_string, edit.new_string, Boolean(edit.replace_all));
    if (current === null) return null;
  }
  return current;
}

/** The action file names for a SKILL.md path, read from its sibling `actions/` directory.
 * Undefined for anything else, matching the engine's own contract. */
function actionFileNamesFor(relPath, absPath) {
  if (path.basename(relPath) !== "SKILL.md") return undefined;
  const actionsDir = path.join(path.dirname(absPath), "actions");
  try {
    return fs.readdirSync(actionsDir).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
}

function fixFor(rule, plugin) {
  return rule === "orthogonality"
    ? `name the concept ${plugin} owns instead of addressing it directly`
    : 'cite every action file the skill provides in its "## Actions" section. A citation is a cell under a table header that reads Action, a fenced `actions/<name>.md` path, or a backticked `<name>.md` file name — a word in prose does not count';
}

function denyReason(violations) {
  return violations
    .map((v) => `${v.message}. Fix: ${fixFor(v.rule, v.plugin)}.`)
    .join("\n");
}

function deny(reason) {
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

function main() {
  const engine = loadEngine();
  if (!engine) return 0;

  const payload = readPayload();
  if (!payload) return 0;

  const toolName = payload.tool_name;
  if (toolName !== "Write" && toolName !== "Edit" && toolName !== "MultiEdit") return 0;

  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput.file_path !== "string" || toolInput.file_path === "") return 0;

  // Resolved once, against the project root, and reused for every filesystem access below — a
  // relative `file_path` must never be read against the process's own cwd, which can differ
  // from CLAUDE_PROJECT_DIR and would otherwise silently empty a readdir this hook depends on.
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relPath = toRepoRelative(toolInput.file_path, root);
  if (!relPath) return 0;

  const info = engine.classifyFile(relPath);
  if (!info) return 0;

  const absPath = path.resolve(root, toolInput.file_path);
  const content = prospectiveContent(toolName, { ...toolInput, file_path: absPath });
  if (content === null) return 0;

  const actionFileNames = actionFileNamesFor(relPath, absPath);

  let violations;
  try {
    violations = engine.checkArchitecture(relPath, content, actionFileNames);
  } catch {
    return 0;
  }

  if (!Array.isArray(violations) || violations.length === 0) return 0;

  deny(denyReason(violations));
  return 0;
}

try {
  process.exitCode = main();
} catch {
  process.exitCode = 0;
}
