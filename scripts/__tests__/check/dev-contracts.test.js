const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { fill, validate } = require("./helpers.js");

const SKILLS = path.resolve(__dirname, "../../../plugins/aidd-dev/skills");
const read = (skill, asset) => fs.readFileSync(path.join(SKILLS, skill, "assets", asset), "utf8");
const script = (skill, kind) => path.join(SKILLS, skill, `scripts/validate-${kind}.cjs`);

describe("review contract", () => {
  const validator = script("05-review", "review");
  const template = read("05-review", "review-template.md");
  const filled = fill(template);

  it("flags the raw template", () => {
    const { code, out } = validate(validator, "review.md", template);
    assert.equal(code, 1);
    assert.match(out, /REVIEW-01 (placeholder|comment) left/u);
  });

  it("accepts the filled template", () => {
    assert.deepEqual(validate(validator, "review.md", filled), { code: 0, out: "", err: "" });
  });
});

describe("assert contract", () => {
  const validator = script("03-assert", "assert");
  const template = read("03-assert", "assert-template.md");
  const filled = fill(template);

  it("flags the raw template", () => {
    const { code, out } = validate(validator, "assert.md", template);
    assert.equal(code, 1);
    assert.match(out, /ASSERT-01 (placeholder|comment) left/u);
  });

  it("accepts the filled template", () => {
    assert.deepEqual(validate(validator, "assert.md", filled), { code: 0, out: "", err: "" });
  });
});

describe("audit contract", () => {
  const validator = script("04-audit", "audit");
  const template = read("04-audit", "audit-template.md");
  const filled = fill(template);

  it("flags the raw template", () => {
    const { code, out } = validate(validator, "2026_11_22_audit/report.md", template);
    assert.equal(code, 1);
    assert.match(out, /AUDIT-01 placeholder left/u);
  });

  it("accepts the filled template", () => {
    assert.deepEqual(validate(validator, "2026_11_22_audit/report.md", filled), { code: 0, out: "", err: "" });
  });
});
