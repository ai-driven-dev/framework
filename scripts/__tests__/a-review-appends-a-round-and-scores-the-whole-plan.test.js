const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const SKILL = path.resolve(__dirname, "../../plugins/aidd-dev/skills/05-review");

/**
 * A review is appended to, one section per round, so a past round sits in the file while the next
 * one is written: the rule that forbids reading it is the only thing between the two. An unmet
 * criterion has one home, and the score counts over the whole plan so a covered third cannot read
 * as a finished plan.
 */

function read(relative) {
  return fs.readFileSync(path.join(SKILL, relative), "utf8");
}

const template = () => read("assets/review-template.md");
const rubric = () => read("references/rubric.md");
const functional = () => read("references/axis-functional.md");

describe("a review appends a round and scores the whole plan", () => {
  it("the steps are actions and the axes are references read on demand", () => {
    assert.deepEqual(fs.readdirSync(path.join(SKILL, "actions")).sort(), ["01-prepare.md", "02-review.md", "03-conclude.md"]);
    for (const axis of ["code", "functional", "relevancy"]) {
      assert.match(read("actions/02-review.md"), new RegExp(`\`${axis}\`: \\[axis\\]\\(\\.\\./references/axis-${axis}\\.md\\)`, "u"));
    }
  });

  it("without a plan, a review runs code and relevancy", () => {
    assert.match(read("actions/01-prepare.md"), /else `code` and `relevancy`, plus `functional` when there is a plan/u);
  });

  it("the round is written once, at the end, and an earlier one is never read back", () => {
    assert.doesNotMatch(read("actions/01-prepare.md"), /template|`review\.md`/u);
    assert.doesNotMatch(read("actions/02-review.md"), /template|`review\.md`/u);
    assert.match(read("actions/03-conclude.md"), /count the `## Round` headings, never read their bodies/u);
    assert.match(read("actions/03-conclude.md"), /from this diff and a run recorded on its head alone/u);
    assert.match(template(), /Append one round per pass, never rewrite an earlier one/u);
  });

  it("alone, the reply can hold the round", () => {
    assert.match(read("actions/03-conclude.md"), /without one, ask whether to keep it in a file/u);
    assert.match(read("actions/03-conclude.md"), /no: the reply holds it/u);
  });

  it("the round's fields are the template's, in order", () => {
    const round = template().slice(template().indexOf("## Round"), template().indexOf("### Criteria"));
    const fields = [...round.matchAll(/^- ([A-Z][\w ]*):/gmu)].map((match) => match[1]);
    assert.deepEqual(fields, ["Diff", "Uncommitted changes", "Axes", "Verdict", "Score"]);
    for (const list of ["Criteria", "Findings", "Limits"]) assert.match(template(), new RegExp(`^### ${list}$`, "mu"));
  });

  it("a finding carries no box, so no state of it can be copied", () => {
    const findings = template().slice(template().indexOf("### Findings"));
    assert.doesNotMatch(findings, /^- \[[ x]\]/mu);
  });

  it("a finding is reachable, and what nothing can reach is kept as a limit", () => {
    assert.match(rubric(), /traceable to current repository input, generated output, a supported host contract or an accepted fixture/u);
    assert.match(rubric(), /A shape nothing can reach is a limit, never a finding/u);
  });

  it("several axes finding one defect make one finding", () => {
    assert.match(read("actions/02-review.md"), /Merge what several axes found into one finding, at its strictest severity/u);
  });

  it("the severity scale is one scale, decided by harm", () => {
    assert.match(rubric(), /^- 🔴 critical: would harm production, its users, their data or what depends on it; must not merge as-is\.$/mu);
    assert.match(template(), /\{\{🔴 critical \| 🟡 major \| 🟢 minor\}\}/u);
  });

  it("the verdict is the strictest that holds, and nothing in scope never approves", () => {
    assert.match(rubric(), /^\| `blocked` \| a critical finding \|$/mu);
    assert.match(rubric(), /^\| `changes-requested` \| a major finding, an unchecked criterion, or `functional` with no criterion in scope \|$/mu);
    assert.match(rubric(), /A criterion out of the diff or unverified at runtime neither blocks nor asks for changes/u);
    assert.match(rubric(), /A round without `functional` is judged on its findings alone/u);
  });

  it("code looks at the tests and at hostile input", () => {
    assert.match(read("references/axis-code.md"), /`tests`: a changed behaviour no test could fail for/u);
    assert.match(read("references/axis-code.md"), /`adversarial`: a malformed or hostile input that reaches the changed lines/u);
  });

  it("relevancy holds the documents the change contradicts", () => {
    assert.match(read("references/axis-relevancy.md"), /a document the change now contradicts included/u);
  });

  it("a phase out of the diff has one line, and the template renders it", () => {
    assert.match(functional(), /files all untouched \| out of the diff, no box/u);
    assert.match(functional(), /projects no file \| traced, never out of the diff/u);
    assert.match(template(), /^- Out of the diff: \{\{phase-name\}\} \(\{\{n\}\} criteria\)$/mu);
  });

  it("only a finished plan owes its declared documentation", () => {
    assert.match(functional(), /status is `implemented` and its `## Impact` documentation row names a phase: that phase is traced/u);
    assert.match(functional(), /Any other status, or a row saying `none`: nothing more/u);
  });

  it("a test the safety net locked is flagged when the diff changes it", () => {
    assert.match(functional(), /A test its safety-net phase locked, modified or deleted by the diff: a major finding/u);
    assert.match(functional(), /The safety net's status: its phase's criteria, from a run recorded on the reviewed head, else unverified/u);
  });

  it("an unmet criterion has one home, and it is not Findings", () => {
    assert.match(functional(), /a name echoing it with no behaviour behind \| unchecked, never a finding/u);
  });

  it("a context line of the diff is evidence, not only an added one", () => {
    assert.match(functional(), /Met, by an added line or a context line \| checked/u);
  });

  it("a criterion only a run could show is unverified, unless a run on this head says", () => {
    assert.match(functional(), /only a run could show, what a screen displays, a timing, an outside system's answer \| unverified, never checked from the code/u);
    assert.match(functional(), /on the reviewed head \| passing: checked, citing the record; failing: unchecked; on another head: unverified/u);
    assert.match(template(), /^- Unverified at runtime: \{\{criterion\}\} — \{\{what a run would show\}\}$/mu);
  });

  it("the score counts over the whole plan, and the template holds its form", () => {
    assert.match(functional(), /met \+ unmet \+ unverified \+ out of the diff = the plan's whole criteria total/u);
    assert.match(functional(), /none to be had: not scored/u);
    assert.match(template(), /or not scored/u);
    assert.match(
      template(),
      /\{\{n_met\}\}\/\{\{n_plan\}\} met, \{\{n_unmet\}\} unmet, \{\{n_unverified\}\} unverified at runtime, \{\{n_out\}\} out of the diff/u,
    );
  });

  it("the flow draws every step and verdict, and a verdict asking for work loops back", () => {
    const router = read("SKILL.md");
    const flow = router.slice(router.indexOf("```mermaid"), router.indexOf("Each box"));
    for (const file of ["actions/01-prepare.md", "actions/02-review.md", "actions/03-conclude.md"]) assert.ok(flow.includes(file), file);
    for (const outcome of ["approve", "changes", "blocked"]) assert.match(flow, new RegExp(`${outcome}\\(\\[`, "u"));
    for (const outcome of ["changes", "blocked"]) assert.match(flow, new RegExp(`^  ${outcome} -\\.->`, "mu"));
  });

  it("a review reads the code and never runs or fixes it", () => {
    assert.match(read("SKILL.md"), /^- Review statically: never run the app\.$/mu);
    assert.match(read("SKILL.md"), /^- Change nothing but the report: no code, no test, no config\.$/mu);
    assert.match(read("SKILL.md"), /Not for fixing what the review finds/u);
  });
});
