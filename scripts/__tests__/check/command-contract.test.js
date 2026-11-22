const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { fill, validate, writeThenValidate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-context/skills/07-command-generate");
const SCRIPT = path.join(SKILL, "scripts/validate-command.cjs");
const TEMPLATE = fs.readFileSync(path.join(SKILL, "assets/command-template.md"), "utf8");

describe("command contract", () => {
  it("flags the raw template", () => {
    const { code, out } = validate(SCRIPT, "review.md", TEMPLATE);
    assert.equal(code, 1);
    assert.match(out, / COMMAND-01 placeholder left/u);
  });

  it("accepts the template filled", () => {
    assert.deepEqual(validate(SCRIPT, "review.md", fill(TEMPLATE)), { code: 0, out: "", err: "" });
  });

  it("accepts the Claude file the writer renders from a drafted command", () => {
    const writer = path.join(SKILL, "scripts/write-command.cjs");
    const body = "# Review\n\nReview the diff.\n\n1. Read it.\n2. Report.\n";
    const request = { name: "review", description: "Review the diff.", "argument-hint": "path", model: "sonnet", body };
    assert.deepEqual(writeThenValidate(writer, SCRIPT, request, "claude", ".claude/commands/review.md"), { code: 0, out: "" });
  });
});
