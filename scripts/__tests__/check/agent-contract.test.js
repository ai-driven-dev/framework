const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const { stripComments, validate: run, writeThenValidate } = require("./helpers.js");

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

const SCRIPT = path.join(SKILL, "scripts/validate-agent.cjs");
const validate = (name, text) => {
  const { code, out } = run(SCRIPT, name, text);
  return { code, out };
};

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

  it("reads the name from each host's file: x.agent.md, x/agent.md; OpenCode and Kilo keep none", () => {
    assert.deepEqual(validate(".github/agents/reviewer.agent.md", FILLED), { code: 0, out: "" });
    assert.deepEqual(validate(".agents/agents/reviewer/agent.md", FILLED), { code: 0, out: "" });
    assert.match(validate(".agents/agents/other/agent.md", FILLED).out, / AGENT-02 .*other/u);
    const unnamed = FILLED.replace("name: reviewer\n", "");
    assert.deepEqual(validate(".opencode/agents/reviewer.md", unnamed), { code: 0, out: "" });
    assert.deepEqual(validate(".kilo/agents/reviewer.md", unnamed), { code: 0, out: "" });
    assert.match(validate(".claude/agents/reviewer.md", unnamed).out, / AGENT-02 /u);
  });

  it("flags a missing description, a name apart from its file, a description without its trigger, wrong sections", () => {
    assert.match(validate("reviewer.md", FILLED.replace(/description: .*\n/u, "")).out, / AGENT-03 /u);
    assert.match(validate("other.md", FILLED).out, / AGENT-02 .*reviewer/u);
    assert.match(validate("reviewer.md", FILLED.replace(". Use to check it before merge", "")).out, / AGENT-03 /u);
    assert.match(validate("reviewer.md", FILLED.replace("# Behavior", "# Rules")).out, / AGENT-04 /u);
  });

  it("accepts the Claude file the writer renders from a drafted agent", () => {
    const body = "# Role\n\nReview the change.\n\n# Behavior\n\n- Read the diff.\n\n# Output\n\nA verdict.\n";
    const request = { name: "reviewer", description: "Reviews a change. Use to check it before merge.", body };
    assert.deepEqual(writeThenValidate(path.join(SKILL, "scripts/write-agent.cjs"), SCRIPT, request, "claude", ".claude/agents/reviewer.md"), { code: 0, out: "" });
  });
});
