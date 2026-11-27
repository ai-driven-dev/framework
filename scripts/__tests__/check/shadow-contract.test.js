const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it } = require("node:test");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-refine/skills/03-shadow-areas");
const SCRIPT = path.join(SKILL, "scripts/validate-shadow-areas.cjs");
const { CATEGORIES } = require(path.join(SKILL, "scripts/custom/report-model.cjs"));

const PRD = `# Checkout PRD

Guests can check out without an account.
Checkout requires a signed-in
account.
The system must respond quickly when the cart is submitted.
On submit, the order is created and a confirmation is shown.
A failed payment returns \`402\` and redirects to \`/cart?retry=1\`.
`;

const REPORT = `---
source: prd.md
status: open
open: 3
---

# Shadow areas: prd.md

## contradiction

- Can a guest check out, or does checkout require an account?
  > Guests can check out without an account.
  > Checkout requires a signed-in account.

## missing failure mode

- What does the user see when the order cannot be created?
  > On submit, the order is created

## ambiguous term

- Quel délai maximum signifie « quickly » au submit du panier ?
  > respond quickly

## Closed

- Who confirms the order?
`;

/** The verdict on prd-shadow-report.md holding `text`, written next to prd.md. */
function check(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-"));
  try {
    fs.writeFileSync(path.join(dir, "prd.md"), PRD);
    fs.writeFileSync(path.join(dir, "prd-shadow-report.md"), text);
    const run = spawnSync(process.execPath, [SCRIPT, path.join(dir, "prd-shadow-report.md")], { encoding: "utf8" });
    return { code: run.status, out: run.stdout, err: run.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Asserts `text` is refused by `id` and by no other rule. */
function refusedOnlyBy(text, id) {
  const { code, out, err } = check(text);
  assert.equal(code, 1, out + err);
  assert.deepEqual([...new Set(out.trim().split("\n").map((line) => line.split(" ")[1]))], [id], out);
}

/** First-column names of a reference's table. */
const tableNames = (file) => [...fs.readFileSync(path.join(SKILL, "references", file), "utf8").matchAll(/^\| ([a-z][a-z ]*?) \|/gmu)].map((m) => m[1]);

describe("shadow contract", () => {
  it("accepts a filled report, quotes matched across line breaks and a question in any language", () => {
    assert.deepEqual(check(REPORT), { code: 0, out: "", err: "" });
  });

  it("accepts a report with no gap, and one with only closed gaps", () => {
    const head = "---\nsource: prd.md\nstatus: clean\nopen: 0\n---\n\n# Shadow areas: prd.md\n";
    assert.deepEqual(check(head), { code: 0, out: "", err: "" });
    assert.deepEqual(check(`${head}\n## Closed\n\n- Who confirms the order?\n`), { code: 0, out: "", err: "" });
  });

  it("refuses the raw template", () => {
    assert.equal(check(fs.readFileSync(path.join(SKILL, "assets/report-template.md"), "utf8")).code, 1);
  });

  it("SHADOW-01 refuses a missing field, a status outside clean and open, and a wrong title", () => {
    refusedOnlyBy(REPORT.replace("open: 3\n", ""), "SHADOW-01");
    refusedOnlyBy(REPORT.replace("status: open", "status: done"), "SHADOW-01");
    refusedOnlyBy(REPORT.replace("# Shadow areas: prd.md", "# Gaps of prd.md"), "SHADOW-01");
  });

  it("SHADOW-02 refuses an unknown category, one out of order, a category after Closed, and a section without gaps", () => {
    refusedOnlyBy(REPORT.replace("## ambiguous term", "## vague wording"), "SHADOW-02");
    refusedOnlyBy(REPORT.replace("## missing failure mode", "## unstated assumption"), "SHADOW-02");
    refusedOnlyBy(`${REPORT}\n## unstated assumption\n\n- Is the cart kept after sign-in?\n  > the cart is submitted\n`.replace("open: 3", "open: 4"), "SHADOW-02");
    refusedOnlyBy(REPORT.replace("- Who confirms the order?\n", ""), "SHADOW-02");
    refusedOnlyBy(REPORT.replace("## ambiguous term\n", "## missing edge case\n\n## ambiguous term\n"), "SHADOW-02");
  });

  it("SHADOW-03 refuses stray prose, two questions, and a statement", () => {
    refusedOnlyBy(REPORT.replace("## Closed\n", "## Closed\n\nSee the checkout page.\n"), "SHADOW-03");
    refusedOnlyBy(REPORT.replace("Who confirms the order?", "Who confirms? When?"), "SHADOW-03");
    refusedOnlyBy(REPORT.replace("Who confirms the order?", "The confirmer is unknown."), "SHADOW-03");
    refusedOnlyBy(REPORT.replace("Who confirms the order?", "Does \"Pay?\" confirm? Who sees it?"), "SHADOW-03");
  });

  it("SHADOW-04 refuses an invented quote, a gap without quote, a one-sided contradiction, and a source not next to the report", () => {
    refusedOnlyBy(REPORT.replace("> respond quickly", "> respond fast"), "SHADOW-04");
    refusedOnlyBy(REPORT.replace("\n  > respond quickly", ""), "SHADOW-04");
    refusedOnlyBy(REPORT.replace("\n  > Checkout requires a signed-in account.", ""), "SHADOW-04");
    refusedOnlyBy(REPORT.replace("source: prd.md", "source: spec.md"), "SHADOW-04");
    refusedOnlyBy(REPORT.replace("source: prd.md", "source: ../prd.md"), "SHADOW-04");
    refusedOnlyBy(REPORT.replace("source: prd.md", "source: .."), "SHADOW-04");
  });

  it("SHADOW-05 refuses the same question twice", () => {
    refusedOnlyBy(REPORT.replace("  > respond quickly", "  > respond quickly\n- quel délai maximum signifie « quickly » au submit du panier ?\n  > the cart is submitted").replace("open: 3", "open: 4"), "SHADOW-05");
  });

  it("accepts a question that quotes a label ending with ?", () => {
    for (const label of ['"Forgot password?"', "“Forgot password?”", "« Mot de passe oublié ? »"]) {
      assert.deepEqual(check(REPORT.replace("Who confirms the order?", `Where does the ${label} link lead?`)), { code: 0, out: "", err: "" });
    }
  });

  it("accepts a split question on one passage, and inline code in questions and quotes", () => {
    const split = REPORT.replace("  > respond quickly", "  > respond quickly\n- Is quickly measured from the click?\n  > respond quickly").replace("open: 3", "open: 4");
    assert.deepEqual(check(split), { code: 0, out: "", err: "" });
    const code = (status) => REPORT.replace("  > On submit, the order is created", `  > On submit, the order is created\n- What does \`${status}\` show after \`/cart?retry=1\`?\n  > returns \`${status}\` and redirects to \`/cart?retry=1\``).replace("open: 3", "open: 4");
    assert.deepEqual(check(code("402")), { code: 0, out: "", err: "" });
    refusedOnlyBy(code("500"), "SHADOW-04");
  });

  it("SHADOW-06 refuses a miscount, closed gaps counted, and a status the count contradicts", () => {
    refusedOnlyBy(REPORT.replace("open: 3", "open: 2"), "SHADOW-06");
    refusedOnlyBy(REPORT.replace("open: 3", "open: 4"), "SHADOW-06");
    refusedOnlyBy(REPORT.replace("status: open", "status: clean"), "SHADOW-06");
  });

  it("states the categories the validator holds, in the same order", () => {
    assert.deepEqual(tableNames("categories.md"), CATEGORIES);
  });
});
