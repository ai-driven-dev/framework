const fs = require("node:fs");

/** The JSON object on stdin, or null when there is none or it is not one. */
function readPayload() {
  try {
    const parsed = JSON.parse(fs.readFileSync(0, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Runs a hook body. A crash never blocks a prompt: every path exits 0, and the only thing
 * ever written to stdout is the one JSON object the body returns. */
function runHook(body) {
  try {
    const payload = readPayload();
    if (payload === null) return;
    const output = body(payload);
    if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch {
    // pass
  }
  process.exitCode = 0;
}

module.exports = { runHook };
