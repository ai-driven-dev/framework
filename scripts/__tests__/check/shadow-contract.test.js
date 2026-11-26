const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { validate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-refine/skills/03-shadow-areas");
const SCRIPT = path.join(SKILL, "scripts/validate-shadow-areas.cjs");

const PLAIN = `---
source: prd.md
generated_at: 2026-11-25T10:00:00Z
---

# Shadow Areas Report

Source: \`prd.md\`
Generated: \`2026-11-25T10:00:00Z\`

Total gaps: 3 | Blocker: 1 | Major: 1 | Minor: 1

## Warnings

- Source is not markdown; snippets may be imprecise.

## Gaps by Category

### ambiguous term

[major] What response time does "quickly" mean when the cart is submitted?
> The system must respond quickly when the cart is submitted.

[minor] Does "items" include gift cards?

### missing failure mode

[blocker] What should the user see when order creation fails?
> On submit, the order is created and a confirmation is shown.
`;

const DIFF = `---
source: prd.md
generated_at: 2026-11-26T10:00:00Z
status: clean
---

# Shadow Areas Report

Source: \`prd.md\`
Generated: \`2026-11-26T10:00:00Z\`

Total gaps: 1 | Blocker: 0 | Major: 0 | Minor: 1

## Gaps by Category

### ambiguous term

#### Closed

[major] What response time does "quickly" mean when the cart is submitted?
> The system must respond quickly when the cart is submitted.

#### Still Open

[minor] Does "items" include gift cards?

### missing failure mode

#### Closed

[blocker] What should the user see when order creation fails?
> On submit, the order is created and a confirmation is shown.
`;

/** The verdict on a prd-shadow-report.md holding `text`. */
const check = (text) => validate(SCRIPT, "prd-shadow-report.md", text);

/** Asserts `text` is refused by `id` and by no other rule. */
function refusedOnlyBy(text, id) {
  const { code, out } = check(text);
  assert.equal(code, 1, out);
  const ids = [...new Set(out.trim().split("\n").map((line) => line.split(" ")[1]))];
  assert.deepEqual(ids, [id], out);
}

describe("shadow contract", () => {
  it("accepts a plain report and a diff report filled from the template", () => {
    assert.deepEqual(check(PLAIN), { code: 0, out: "", err: "" });
    assert.deepEqual(check(DIFF), { code: 0, out: "", err: "" });
  });

  it("SHADOW-01 refuses a missing section, an unknown part, a slot left and a status other than clean", () => {
    refusedOnlyBy(PLAIN.replace("## Warnings", "## Notes"), "SHADOW-01");
    refusedOnlyBy(DIFF.replace("#### Still Open", "#### Reopened"), "SHADOW-01");
    refusedOnlyBy(PLAIN.replace("Source: `prd.md`", "Source: `{{source path}}`"), "SHADOW-01");
    refusedOnlyBy(DIFF.replace("status: clean", "status: done"), "SHADOW-01");
  });

  it("SHADOW-02 refuses an unknown category and categories out of the locked order", () => {
    refusedOnlyBy(PLAIN.replace("### ambiguous term", "### vague wording"), "SHADOW-02");
    refusedOnlyBy(PLAIN.replace("### ambiguous term", "### missing dependency"), "SHADOW-02");
  });

  it("SHADOW-03 refuses an unknown severity, a probe that is not a question, gaps out of severity order and stray prose", () => {
    refusedOnlyBy(PLAIN.replace("[minor] Does", "[trivial] Does").replace("Minor: 1", "Minor: 0"), "SHADOW-03");
    refusedOnlyBy(PLAIN.replace("Does \"items\" include gift cards?", "Gift cards are unclear."), "SHADOW-03");
    refusedOnlyBy(PLAIN.replace(/(\[major\][^\n]*\n>[^\n]*\n)\n(\[minor\][^\n]*\n)/u, "$2\n$1"), "SHADOW-03");
    refusedOnlyBy(PLAIN.replace("### missing failure mode\n", "### missing failure mode\n\nSee the checkout section.\n"), "SHADOW-03");
  });

  it("SHADOW-04 refuses totals that miscount, closed gaps included", () => {
    refusedOnlyBy(PLAIN.replace("Total gaps: 3", "Total gaps: 4"), "SHADOW-04");
    refusedOnlyBy(DIFF.replace("Total gaps: 1 | Blocker: 0 | Major: 0", "Total gaps: 3 | Blocker: 1 | Major: 1"), "SHADOW-04");
  });

  it("SHADOW-05 refuses a clean stamp over a blocker, and a missing one when nothing blocks", () => {
    refusedOnlyBy(PLAIN.replace("generated_at: 2026-11-25T10:00:00Z\n", "generated_at: 2026-11-25T10:00:00Z\nstatus: clean\n"), "SHADOW-05");
    refusedOnlyBy(DIFF.replace("status: clean\n", ""), "SHADOW-05");
  });
});
