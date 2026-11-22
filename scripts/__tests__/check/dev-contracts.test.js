const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { fill, validate } = require("./helpers.js");

const SKILLS = path.resolve(__dirname, "../../../plugins/aidd-dev/skills");
const read = (skill, asset) => fs.readFileSync(path.join(SKILLS, skill, "assets", asset), "utf8");
const script = (skill, kind) => path.join(SKILLS, skill, `scripts/validate-${kind}.cjs`);

/** A second round: the filled round again under the next heading. */
const twice = (filled) => `${filled}\n${filled.slice(filled.indexOf("## Round")).replace("## Round x", "## Round y")}`;

describe("review contract", () => {
  const validator = script("05-review", "review");
  const template = read("05-review", "review-template.md");
  const filled = fill(template);

  it("flags the raw template", () => {
    const { code, out } = validate(validator, "review.md", template);
    assert.equal(code, 1);
    assert.match(out, /REVIEW-01 (placeholder|comment) left/u);
  });

  it("accepts the filled template, with or without each ### section, and two rounds", () => {
    assert.deepEqual(validate(validator, "review.md", filled), { code: 0, out: "", err: "" });
    for (const name of ["Criteria", "Assumptions", "Findings", "Limits"]) {
      const without = filled.replace(new RegExp(`### ${name}\\n[\\s\\S]*?(?=\\n###|\\n*$)`, "u"), "");
      assert.equal(validate(validator, "review.md", without).code, 0, name);
    }
    assert.equal(validate(validator, "review.md", twice(filled)).code, 0);
  });

  it("names an unknown or reordered ### and a second title", () => {
    assert.match(validate(validator, "review.md", `${filled}\n### Notes\n`).out, /"Notes" is not in the template/u);
    const swapped = filled.replace("### Criteria", "### Limits").replace(/### Limits\n(?![\s\S]*### Limits)/u, "### Criteria\n");
    assert.match(validate(validator, "review.md", swapped).out, /out of order/u);
    assert.match(validate(validator, "review.md", `${filled}\n# Review: again\n`).out, /one title only/u);
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

  it("accepts the filled template and two rounds", () => {
    assert.deepEqual(validate(validator, "assert.md", filled), { code: 0, out: "", err: "" });
    assert.equal(validate(validator, "assert.md", twice(filled)).code, 0);
  });

  it("names a round whose table header differs", () => {
    assert.match(validate(validator, "assert.md", filled.replace("| Failure |", "| Why |")).out, /table header differs/u);
  });
});

describe("audit contract", () => {
  const validator = script("04-audit", "audit");
  const template = read("04-audit", "audit-template.md");
  const filled = fill(template);

  it("keeps no front matter in the template", () => {
    assert.ok(!template.startsWith("---"));
  });

  it("flags the raw template", () => {
    const { code, out } = validate(validator, "2026_11_22_audit/report.md", template);
    assert.equal(code, 1);
    assert.match(out, /AUDIT-01 placeholder left/u);
  });

  it("accepts the filled template", () => {
    assert.deepEqual(validate(validator, "2026_11_22_audit/report.md", filled), { code: 0, out: "", err: "" });
  });

  it("names a missing section", () => {
    assert.match(validate(validator, "2026_11_22_audit/report.md", filled.replace("## Coverage", "")).out, /"Coverage" missing/u);
  });
});
