const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const engine = require("../../contract/engine.cjs");

const ENGINE = path.resolve(__dirname, "../../contract/engine.cjs");
const RUN = "process.exitCode = require(process.argv[1]).run(process.argv[2], process.argv.slice(3));";

/** A template filled the way a model fills it: comments and the closing note dropped, every slot given a value. */
function fill(template) {
  return template
    .replace(/<!--[\s\S]*?-->\n?/gu, "")
    .replace(/^> Fill every.*\n?/mu, "")
    .replace(/\{\{[^}\n]*\}\}/gu, "x");
}

/** The engine's CLI on a contract and its targets, as a process: exit status, stdout and stderr. */
function lint(contractFile, ...targets) {
  const run = spawnSync(process.execPath, ["-e", RUN, ENGINE, contractFile, ...targets], { encoding: "utf8" });
  return { status: run.status, out: run.stdout, err: run.stderr };
}

/** The engine's findings on one target, in process. */
const findings = (contractFile, target) => engine.check(engine.loadContract(contractFile), target);

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

/** Runs a skill's writer on a request in a scratch project, then its validator on one file the writer produced. */
function writeThenValidate(writer, validator, request, tools, produced) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "contract-writer-")));
  try {
    const input = path.join(dir, "request.json");
    fs.writeFileSync(input, JSON.stringify(request));
    const project = path.join(dir, "project");
    fs.mkdirSync(project);
    const written = spawnSync(process.execPath, [writer, "--project", project, "--tools", tools, "--input", input], { encoding: "utf8" });
    if (written.status !== 0) return { code: -1, out: written.stdout + written.stderr };
    const run = spawnSync(process.execPath, [validator, path.join(project, produced)], { encoding: "utf8" });
    return { code: run.status, out: run.stdout.split(project).join("") };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { fill, validate, lint, findings, writeThenValidate };
