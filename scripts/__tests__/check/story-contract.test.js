const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { fill, validate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-pm/skills/02-user-stories");
const SCRIPT = path.join(SKILL, "scripts/validate-story.cjs");
const TEMPLATE = fs.readFileSync(path.join(SKILL, "assets/user-story-template.md"), "utf8");
const FILLED = fill(TEMPLATE);

describe("story contract", () => {
  it("flags the raw template", () => {
    const { code, out } = validate(SCRIPT, "story.md", TEMPLATE);
    assert.equal(code, 1);
    assert.match(out, / STORY-01 placeholder left/u);
  });

  it("accepts the template filled", () => {
    assert.deepEqual(validate(SCRIPT, "story.md", FILLED), { code: 0, out: "", err: "" });
  });
});
