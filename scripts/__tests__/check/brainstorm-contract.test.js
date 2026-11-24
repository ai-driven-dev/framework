const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { validate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-refine/skills/01-brainstorm");
const SCRIPT = path.join(SKILL, "scripts/validate-brainstorm.cjs");

const GOOD = `---
status: approved
---

# Cart reservation

Shoppers keep what they put in the cart, so checkout never fails on stock.

## Clear

- a reservation holds stock for the items in the cart

## Assumed

- a reservation lasts 15 minutes, as the shop's sessions do

## Open

- should a reservation survive a logout?
`;

/** The verdict on a brainstorm.md holding `text`. */
const check = (text) => validate(SCRIPT, "brainstorm.md", text);

/** Asserts `text` is refused by `id` and by no other rule. */
function refusedOnlyBy(text, id) {
  const { code, out } = check(text);
  assert.equal(code, 1, out);
  const ids = [...new Set(out.trim().split("\n").map((line) => line.split(" ")[1]))];
  assert.deepEqual(ids, [id], out);
}

describe("brainstorm contract", () => {
  it("accepts a brief filled from the template, with Windows line endings too", () => {
    assert.deepEqual(check(GOOD), { code: 0, out: "", err: "" });
    assert.deepEqual(check(GOOD.replaceAll("\n", "\r\n")), { code: 0, out: "", err: "" });
  });

  it("accepts a brief that omits an empty section", () => {
    assert.deepEqual(check(GOOD.replace("## Assumed\n\n- a reservation lasts 15 minutes, as the shop's sessions do\n\n", "")), { code: 0, out: "", err: "" });
  });

  it("BRAINSTORM-01 refuses a section unknown or out of order", () => {
    refusedOnlyBy(GOOD.replace("## Open", "## Questions"), "BRAINSTORM-01");
    refusedOnlyBy(GOOD.replace("## Clear", "## Swap").replace("## Open", "## Clear").replace("## Swap", "## Open"), "BRAINSTORM-01");
  });

  it("BRAINSTORM-01 refuses a status missing or other than approved", () => {
    refusedOnlyBy(GOOD.replace("---\nstatus: approved\n---\n\n", ""), "BRAINSTORM-01");
    refusedOnlyBy(GOOD.replace("status: approved", "status: pending"), "BRAINSTORM-01");
  });

  it("BRAINSTORM-01 refuses a comment or a placeholder left, with Windows line endings too", () => {
    refusedOnlyBy(GOOD.replace("# Cart reservation", "<!-- Fill, then strip this comment. -->\n\n# Cart reservation"), "BRAINSTORM-01");
    refusedOnlyBy(GOOD.replace("should a reservation survive a logout?", "{{Question whose answer could change what gets made.}}"), "BRAINSTORM-01");
    refusedOnlyBy(GOOD.replace("status: approved", "status: pending").replaceAll("\n", "\r\n"), "BRAINSTORM-01");
  });
});
