const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { validate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-pm/skills/04-spec");
const SCRIPT = path.join(SKILL, "scripts/validate-spec.cjs");

const GOOD = `# Account data export

## Target

Allow authenticated users to export their account data as a downloadable JSON file.

## Hard constraints

- the export holds only the requesting user's data

## Non-goals

- exporting another user's data

## Done-when

- a signed-in user receives a file holding every field of their account

## Open Questions

- TBD: should the export include deleted items?

## Stakeholders

- Decider: product owner

## Context

- the account settings page already lists every field
`;

/** The verdict on a spec.md holding `text`. */
const check = (text) => validate(SCRIPT, "spec.md", text);

/** Asserts `text` is refused by `id` and by no other rule. */
function refusedOnlyBy(text, id) {
  const { code, out } = check(text);
  assert.equal(code, 1, out);
  const ids = [...new Set(out.trim().split("\n").map((line) => line.split(" ")[1]))];
  assert.deepEqual(ids, [id], out);
}

describe("spec contract", () => {
  it("accepts a spec filled from the template, with Windows line endings too", () => {
    assert.deepEqual(check(GOOD), { code: 0, out: "", err: "" });
    assert.deepEqual(check(GOOD.replaceAll("\n", "\r\n")), { code: 0, out: "", err: "" });
  });

  it("accepts a spec that omits its optional sections", () => {
    assert.deepEqual(check(GOOD.slice(0, GOOD.indexOf("## Stakeholders"))), { code: 0, out: "", err: "" });
  });

  it("SPEC-01 refuses a required section missing, unknown or out of order", () => {
    refusedOnlyBy(GOOD.replace("## Non-goals\n\n- exporting another user's data\n\n", ""), "SPEC-01");
    refusedOnlyBy(GOOD.replace("## Hard constraints", "## Constraints"), "SPEC-01");
    refusedOnlyBy(GOOD.replace("## Target", "## Swap").replace("## Done-when", "## Target").replace("## Swap", "## Done-when"), "SPEC-01");
  });

  it("SPEC-01 refuses a comment or a placeholder left", () => {
    refusedOnlyBy(`<!-- Fill or omit these sections. -->\n\n${GOOD}`, "SPEC-01");
    refusedOnlyBy(GOOD.replace("- exporting another user's data", "- {{Out-of-scope item}}"), "SPEC-01");
  });
});
