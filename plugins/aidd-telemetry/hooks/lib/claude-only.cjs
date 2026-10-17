// Codex delivers the same event names, and a Codex started inside Claude inherits Claude's
// session variable. Only a payload whose id equals the variable AND whose transcript lives
// in a Claude `projects` directory is Claude's own.
const CODEX_ROLLOUT = /\/sessions\/\d{4}\/\d{2}\/\d{2}\/rollout-/u;
const CLAUDE_TRANSCRIPT = /(?:^|\/)projects\/.+\.jsonl$/u;

function text(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function isClaudePayload(payload, env = process.env) {
  if (payload === null || typeof payload !== "object") return false;
  const id = text(payload.session_id);
  if (id === null || id !== text(env.CLAUDE_CODE_SESSION_ID)) return false;
  const transcript = text(payload.transcript_path);
  if (transcript === null) return false;
  const normalised = transcript.replace(/\\/gu, "/");
  return !CODEX_ROLLOUT.test(normalised) && CLAUDE_TRANSCRIPT.test(normalised);
}

module.exports = { isClaudePayload };
