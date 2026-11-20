const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { fill, validate } = require("./helpers.js");

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

  it("flags a leftover note line", () => {
    assert.match(validate(SCRIPT, "review.md", `${fill(TEMPLATE)}\n> Fill every \`{{...}}\` and delete this line.\n`).out, / COMMAND-01 /u);
  });
});
