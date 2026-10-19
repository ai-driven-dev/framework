const { isClaudePayload } = require("./claude-only.cjs");
const { CODEX_ROLLOUT } = require("./codex-session-file.cjs");

function text(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

/** A Codex session file, which only Codex hands a hook. A Codex started inside Claude Code inherits
 * Claude's session variable, so the path decides, never the variable. */
function isCodexPayload(payload) {
  if (payload === null || typeof payload !== "object" || text(payload.session_id) === null) return false;
  const transcript = text(payload.transcript_path);
  return transcript !== null && CODEX_ROLLOUT.test(transcript.replace(/\\/gu, "/"));
}

/** Which tool's hook this payload is: `claude`, `codex`, or null, for which a hook does nothing. */
function hookTool(payload, env = process.env) {
  if (isClaudePayload(payload, env)) return "claude";
  return isCodexPayload(payload) ? "codex" : null;
}

module.exports = { hookTool };
