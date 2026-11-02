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
const code = () => read("references/axis-code.md");

describe("a review appends a round and scores the whole plan", () => {
  it("the steps are actions and the axes are references read on demand", () => {
    assert.deepEqual(fs.readdirSync(path.join(SKILL, "actions")).sort(), ["01-prepare.md", "02-review.md", "03-conclude.md"]);
    for (const axis of ["code", "functional", "relevancy"]) {
      assert.match(read("actions/02-review.md"), new RegExp(`\\[${axis}\\]\\(\\.\\./references/axis-${axis}\\.md\\)`, "u"));
    }
  });

  it("a review takes the work alone, and functional only with a plan", () => {
    assert.match(read("actions/01-prepare.md"), /The work, and its plan, criteria, ticket, task folder or evidence if any/u);
    assert.match(read("actions/01-prepare.md"), /else all of them, `functional` only with a plan or criteria; named without them, ask/u);
  });

  it("the round is written once, at the end, and an earlier one is never judged", () => {
    assert.doesNotMatch(read("actions/01-prepare.md"), /template|`review\.md`/u);
    assert.doesNotMatch(read("actions/02-review.md"), /template|`review\.md`/u);
    assert.match(read("SKILL.md"), /^- Judge this work alone, never an earlier round\.$/mu);
    assert.match(template(), /\{\{the count of round headings, this one included\}\}/u);
    assert.match(template(), /Append one round per pass, never rewrite an earlier one/u);
  });

  it("alone, the reply can hold the round", () => {
    assert.match(read("actions/03-conclude.md"), /without one, ask whether to keep it in a file/u);
    assert.match(read("actions/03-conclude.md"), /no: the reply holds it/u);
  });

  it("the round's fields are the template's, in order", () => {
    const round = template().slice(template().indexOf("## Round"), template().indexOf("### Criteria"));
    const fields = [...round.matchAll(/^- ([A-Z][\w ]*):/gmu)].map((match) => match[1]);
    assert.deepEqual(fields, ["Diff", "Uncommitted changes", "Axes", "Verdict", "Score", "Coverage"]);
    for (const list of ["Criteria", "Findings", "Limits"]) assert.match(template(), new RegExp(`^### ${list}$`, "mu"));
  });

  it("a finding carries no box, so no state of it can be copied", () => {
    assert.doesNotMatch(template().slice(template().indexOf("### Findings")), /^- \[[ x]\]/mu);
  });

  it("a finding is reachable, and what nothing can reach is kept as a limit", () => {
    assert.match(rubric(), /tied to the diff, reachable from a real input, caller or contract/u);
    assert.match(rubric(), /What nothing can reach is a limit, never a finding/u);
  });

  it("one defect makes one finding, whichever axes found it", () => {
    assert.match(read("actions/02-review.md"), /one finding per defect, whichever axes found it/u);
  });

  it("the severity scale is one scale, decided by harm", () => {
    assert.match(rubric(), /^\| 🔴 critical \| would harm production, its users, their data or what depends on it \|$/mu);
    assert.match(rubric(), /^\| 🟡 major \| a user or a caller will hit it, or the next change will \|$/mu);
    assert.match(rubric(), /^\| 🟢 minor \| nothing breaks if it stays \|$/mu);
    assert.match(template(), /\{\{🔴 critical \| 🟡 major \| 🟢 minor\}\}/u);
  });

  it("the verdict is the strictest that holds, and nothing in scope never approves", () => {
    assert.match(rubric(), /^\| `blocked` \| a critical finding \|$/mu);
    assert.match(rubric(), /^\| `changes-requested` \| a major finding, an unchecked criterion, or `functional` with no criterion met \|$/mu);
  });

  it("code reads what the diff reaches, each kind saying what to look for", () => {
    assert.match(code(), /Read the diff and what it reaches/u);
    for (const kind of ["correctness", "compatibility", "security", "error-handling", "performance", "architecture", "interface", "code-health", "tests", "regression", "adversarial"]) {
      assert.match(code(), new RegExp(`^\\| \`${kind}\` \\| [a-z]`, "mu"), kind);
    }
  });

  it("relevancy holds the documents the change contradicts", () => {
    assert.match(read("references/axis-relevancy.md"), /a document the change contradicts/u);
  });

  it("a phase out of the diff has one line, and the template renders it", () => {
    assert.match(functional(), /projected files all untouched \| out of the diff, no box/u);
    assert.match(template(), /^- Out of the diff: \{\{phase-name\}\} \(\{\{n\}\} criteria\)$/mu);
  });

  it("the safety net and a finished plan's documentation are traced even when untouched", () => {
    assert.match(functional(), /In the safety-net phase \| traced, even untouched/u);
    assert.match(functional(), /In the phase an `implemented` plan's `## Impact` documentation row names \| traced, even untouched/u);
  });

  it("a weakened test is a defect, with or without a plan", () => {
    assert.match(code(), /`regression` \| an existing test weakened or deleted/u);
  });

  it("an unmet criterion has one home, and it is not Findings", () => {
    assert.match(functional(), /a name echoing it with no behaviour behind \| unchecked, never a finding/u);
  });

  it("a criterion only a run could show is unverified, unless a run on this head settles it", () => {
    assert.match(functional(), /Only a run could show it \| unverified, unless a run recorded on this head settles it/u);
    assert.match(template(), /^- Unverified at runtime: \{\{criterion\}\} — \{\{what a run would show\}\}$/mu);
  });

  it("the score is always there and explains the verdict, the coverage only with criteria", () => {
    assert.match(template(), /^- Score: \{\{n\}\} critical, \{\{n\}\} major, \{\{n\}\} minor$/mu);
    assert.match(template(), /leave out what has nothing to hold/u);
    assert.match(template(), /^- Coverage: \{\{n\}\}\/\{\{the plan's whole criteria total\}\} met, \{\{n\}\} unmet, \{\{n\}\} unverified at runtime, \{\{n\}\} out of the diff$/mu);
  });

  it("the flow draws every step and verdict", () => {
    const router = read("SKILL.md");
    const flow = router.slice(router.indexOf("```mermaid"), router.indexOf("Each box"));
    for (const file of ["actions/01-prepare.md", "actions/02-review.md", "actions/03-conclude.md"]) assert.ok(flow.includes(file), file);
    for (const outcome of ["approve", "changes", "blocked"]) assert.match(flow, new RegExp(`${outcome}\\(\\[`, "u"));
  });

  it("a review reads the code and never runs or fixes it", () => {
    assert.match(read("SKILL.md"), /^- Read only: never run the app or its checks\.$/mu);
    assert.match(read("SKILL.md"), /^- Change nothing but the report: no code, no test, no config\.$/mu);
    assert.match(read("SKILL.md"), /Not for fixing what the review finds/u);
  });
});
