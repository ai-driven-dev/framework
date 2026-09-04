const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const script = path.join(root, "scripts/check-skill-argument-hints.mjs");

function writeSkillTree(cwd, { skillBody, actionBody }) {
  const skillDir = path.join(cwd, "plugins", "demo", "skills", "01-sample");
  fs.mkdirSync(path.join(skillDir, "actions"), { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillBody);
  fs.writeFileSync(path.join(skillDir, "actions", "01-run.md"), actionBody);
}

function runChecker(cwd) {
  return spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
}

const actionWithInput = ["# Run", "", "## Input", "", "The request.", ""].join("\n");

const lfSkill = [
  "---",
  "name: 01-sample",
  "description: Demo skill.",
  "argument-hint: request",
  "---",
  "",
  "# Sample",
  "",
].join("\n");

const crlfSkill = lfSkill.replaceAll("\n", "\r\n");

test("accepts argument-hint in LF frontmatter", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "arg-hint-lf-"));
  try {
    writeSkillTree(cwd, { skillBody: lfSkill, actionBody: actionWithInput });
    const result = runChecker(cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Every skill names what the user brings/u);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("accepts argument-hint in CRLF frontmatter", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "arg-hint-crlf-"));
  try {
    writeSkillTree(cwd, { skillBody: crlfSkill, actionBody: actionWithInput });
    const result = runChecker(cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Every skill names what the user brings/u);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
