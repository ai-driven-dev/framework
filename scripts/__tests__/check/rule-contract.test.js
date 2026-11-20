const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { fill, validate, writeThenValidate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-context/skills/05-rule-generate");
const SCRIPT = path.join(SKILL, "scripts/validate-rule.cjs");
const TEMPLATE = fs.readFileSync(path.join(SKILL, "assets/rule-template.md"), "utf8");
const NAME = "aidd_docs/rules/01-standards/1-naming.md";
const FILLED = fill(TEMPLATE);

describe("rule contract", () => {
  it("flags the raw template", () => {
    const { code, out } = validate(SCRIPT, NAME, TEMPLATE);
    assert.equal(code, 1);
    assert.match(out, / RULE-01 front matter "description": placeholder left/u);
  });

  it("accepts the template filled", () => {
    assert.deepEqual(validate(SCRIPT, NAME, FILLED), { code: 0, out: "", err: "" });
  });

  it("accepts a rule the writer renders, scoped or not, with groups or without", () => {
    const scoped = '---\ndescription: "Naming"\npaths:\n  - "src/**/*.ts"\ntargets: [claude, cursor]\n---\n\n# Naming\n\n- Keep names clear.\n\n## Files\n\n- One per file.\n';
    const unscoped = '---\ndescription: "Naming"\ntargets: [claude]\n---\n\n# Naming\n\n- Keep names clear.\n';
    assert.equal(validate(SCRIPT, NAME, scoped).code, 0);
    assert.equal(validate(SCRIPT, NAME, unscoped).code, 0);
  });

  it("flags a rule with no description, and one with a key the template lacks", () => {
    assert.match(validate(SCRIPT, NAME, FILLED.replace(/description: .*\n/u, "")).out, /front matter key "description" missing/u);
    assert.match(validate(SCRIPT, NAME, FILLED.replace("targets:", "host: x\ntargets:")).out, /front matter key "host" is not in the template/u);
  });

  it("flags a rule with no targets", () => {
    assert.match(validate(SCRIPT, NAME, FILLED.replace(/targets: .*\n/u, "")).out, /front matter key "targets" missing/u);
  });

  it("accepts the source the writer renders from a drafted rule", () => {
    const writer = path.join(SKILL, "scripts/write-rule.cjs");
    const body = "# Naming\n\n- Name a thing for what it is.\n";
    const request = { category: "01-standards", slug: "1-naming", description: "When naming things.", paths: ["src/**/*.ts"], body };
    assert.deepEqual(writeThenValidate(writer, SCRIPT, request, "claude", "aidd_docs/rules/01-standards/1-naming.md"), { code: 0, out: "" });
  });
});
