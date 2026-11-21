const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const { stripComments, writeThenValidate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-context/skills/06-agent-generate");
const TEMPLATE = path.join(SKILL, "assets/agent-template.md");

/** The agent contract: the raw template is flagged, a filled agent is clean, each rule has its mutation. */

const FILLED = [
  "---",
  "name: reviewer",
  "description: Reviews a change. Use to check it before merge.",
  "---",
  "",
  "# Role",
  "",
  "Review the change.",
  "",
  "# Behavior",
  "",
  "- Read the diff.",
  "",
  "# Output",
  "",
  "A verdict.",
  "",
].join("\n");

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-contract-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function validate(name, text) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  const run = spawnSync(process.execPath, [path.join(SKILL, "scripts/validate-agent.cjs"), file], { encoding: "utf8" });
  return { code: run.status, out: run.stdout };
}

describe("agent contract", () => {
  it("accepts a filled agent", () => {
    assert.deepEqual(validate("reviewer.md", FILLED), { code: 0, out: "" });
  });

  it("flags the raw template", () => {
    const { code, out } = validate("reviewer.md", fs.readFileSync(TEMPLATE, "utf8"));
    assert.equal(code, 1);
    assert.match(out, / AGENT-05 /u);
  });

  it("accepts the template once its slots and comments are filled", () => {
    const filled = stripComments(fs.readFileSync(TEMPLATE, "utf8")).replace(/\{\{([^}]*)\}\}/gu, (_, slot) => slot.replace(/\W+/gu, "-"));
    assert.deepEqual(validate("name.md", filled.replace(/^name: .*$/mu, "name: name")), { code: 0, out: "" });
  });

  it("flags a missing description, a name apart from its file, a description without its trigger, wrong sections", () => {
    assert.match(validate("reviewer.md", FILLED.replace(/description: .*\n/u, "")).out, / AGENT-03 /u);
    assert.match(validate("other.md", FILLED).out, / AGENT-02 .*reviewer/u);
    assert.match(validate("reviewer.md", FILLED.replace(". Use to check it before merge", "")).out, / AGENT-03 /u);
    assert.match(validate("reviewer.md", FILLED.replace("# Behavior", "# Rules")).out, / AGENT-04 /u);
  });

  it("allows bold, which agents are not held to", () => {
    assert.deepEqual(validate("reviewer.md", FILLED.replace("Review the change.", "Review the **change**.")), { code: 0, out: "" });
  });

  it("accepts the Claude file the writer renders from a drafted agent", () => {
    const body = "# Role\n\nReview the change.\n\n# Behavior\n\n- Read the diff.\n\n# Output\n\nA verdict.\n";
    const request = { name: "reviewer", description: "Reviews a change. Use to check it before merge.", body };
    const validator = path.join(SKILL, "scripts/validate-agent.cjs");
    assert.deepEqual(writeThenValidate(path.join(SKILL, "scripts/write-agent.cjs"), validator, request, "claude", ".claude/agents/reviewer.md"), { code: 0, out: "" });
  });
});
