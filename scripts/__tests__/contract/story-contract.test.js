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

  it("accepts the template filled, with or without its Cancellation section", () => {
    assert.deepEqual(validate(SCRIPT, "story.md", FILLED), { code: 0, out: "", err: "" });
    assert.equal(validate(SCRIPT, "story.md", FILLED.replace(/\n## Cancellation[\s\S]*$/u, "\n")).code, 0);
  });

  it("accepts every status of the lifecycle", () => {
    for (const status of ["proposed", "ready", "in-progress", "done", "cancelled"]) {
      assert.equal(validate(SCRIPT, "story.md", FILLED.replace("status: proposed", `status: ${status}`)).code, 0, status);
    }
  });

  it("lists the allowed statuses when the status is outside the lifecycle", () => {
    const { code, out } = validate(SCRIPT, "story.md", FILLED.replace("status: proposed", "status: archived"));
    assert.equal(code, 1);
    assert.match(out, /STORY-01 front matter "status" must be one of proposed, ready, in-progress, done, cancelled/u);
  });
});
