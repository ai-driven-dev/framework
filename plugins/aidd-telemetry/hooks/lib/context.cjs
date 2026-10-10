const fs = require("node:fs");
const { isClaudePayload } = require("./claude-only.cjs");
const { consentGranted } = require("./consent.cjs");

/** The guards every hook shares, cheapest first: Claude's own payload (environment only), then
 * one `git config` call for consent. Null means the hook does nothing, silently. */
function guardedContext(payload, env = process.env) {
  if (!isClaudePayload(payload, env)) return null;
  const cwd = typeof payload.cwd === "string" && isDirectory(payload.cwd) ? payload.cwd : process.cwd();
  if (!consentGranted(cwd, env)) return null;
  return { cwd };
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { guardedContext };
