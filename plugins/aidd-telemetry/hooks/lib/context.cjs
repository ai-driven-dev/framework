const fs = require("node:fs");
const { consentGranted } = require("./consent.cjs");
const { hookTool } = require("./tool.cjs");

const EVERY_TOOL = ["claude", "codex"];

/** The guards every hook shares, cheapest first: a payload of one of the `tools` (environment
 * only), then consent. Consent reads `consents.jsonl` and spawns no git while no interval is open
 * on the machine; otherwise it spawns two git calls for the directory (`rev-parse
 * --git-common-dir`, `config --local --get`), and `stat`s the clone's git dir. Null means the hook
 * does nothing, silently. */
function guardedContext(payload, env = process.env, tools = EVERY_TOOL) {
  const tool = hookTool(payload, env);
  if (tool === null || !tools.includes(tool)) return null;
  const cwd = typeof payload.cwd === "string" && isDirectory(payload.cwd) ? payload.cwd : process.cwd();
  if (!consentGranted(cwd, env)) return null;
  return { cwd, tool };
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { guardedContext };
