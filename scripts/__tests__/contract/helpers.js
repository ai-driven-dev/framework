const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

/** A template filled the way a model fills it: comments and the closing note dropped, every slot given a value. */
function fill(template) {
  return template
    .replace(/<!--[\s\S]*?-->\n?/gu, "")
    .replace(/^> Fill every.*\n?/mu, "")
    .replace(/\{\{[^}\n]*\}\}/gu, "x");
}

/** Runs a validate-<kind>.cjs on one file written under a scratch folder; returns exit code and stdout. */
function validate(script, name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"));
  try {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    const run = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    return { code: run.status, out: run.stdout, err: run.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { fill, validate };
