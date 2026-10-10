const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const SKILL = path.resolve(__dirname, "../../plugins/aidd-dev/skills/05-review");

/**
 * A review is appended to, one section per round, so a past round sits in the file while the next
 * one is written: the rules that forbid reading it are the only thing between the two. The field
 * set and the template are the two sides of a round's shape, an unmet criterion has one home, and
 * the score counts over the whole plan so a covered third cannot read as a finished plan.
 */

function read(relative) {
  return fs.readFileSync(path.join(SKILL, relative), "utf8");
}

/** The router's transversal rules, whatever bullet each one sits on. */
function rules() {
  const router = read("SKILL.md");
  return router.slice(router.indexOf("## Transversal rules"));
}

/** One `## Process` step with the sub-items that qualify it. */
function step(relative, label) {
  const body = read(relative);
  const opens = new RegExp(`^\\d+\\. \\*\\*${label}\\.\\*\\*`, "mu").exec(body);
  if (!opens) return "";
  const rest = body.slice(opens.index);
  const ends = /^(?:\d+\. |## )/mu.exec(rest.slice(1));
  return ends ? rest.slice(0, ends.index + 1) : rest;
}

function everyMarkdown(directory, into) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) everyMarkdown(full, into);
    else if (entry.name.endsWith(".md")) into.push(full);
  }
  return into;
}

/** A path under the skill, spelled the way the documents spell it, on every platform. */
function inSkill(file) {
  return path.relative(SKILL, file).split(path.sep).join("/");
}

describe("a review appends a round and scores the whole plan", () => {
  it("a round is appended, and an earlier one is never read back", () => {
    const reference = read("references/report-contract.md");
    assert.match(reference, /Append a round, derived from the plan and the current diff alone/u);
    assert.match(
      reference,
      /Count the `## Round` headings, never read their bodies/u,
      "and reads no earlier round",
    );
  });

  it("the report's address, its diff and its rounds have one home", () => {
    const homes = everyMarkdown(SKILL, [])
      .filter((file) =>
        /Count the `## Round` headings|aidd_docs\/tasks\/<yyyy_mm>|branch's pull request target/u.test(
          fs.readFileSync(file, "utf8"),
        ),
      )
      .map(inSkill);
    assert.deepEqual(homes, ["references/report-contract.md"]);
  });

  it("the artifact is named, and no file of the skill can pass for it", () => {
    assert.match(read("references/report-contract.md"), /one `review\.md`, appended to, never rewritten/u);
    const lookalikes = fs
      .readdirSync(path.join(SKILL, "references"))
      .concat(fs.readdirSync(path.join(SKILL, "assets")))
      .filter((file) => /^review[-_]/u.test(file) && !/template|validator|rubric/u.test(file));
    assert.deepEqual(lookalikes, [], "a sibling named review-* reads as the artifact");
  });

  it("the report reference is read by prepare and finalize, not by an axis", () => {
    const cites = fs
      .readdirSync(path.join(SKILL, "actions"))
      .filter((action) => /report-contract\.md/u.test(read(path.join("actions", action))));
    assert.deepEqual(cites, ["01-prepare.md", "05-finalize.md"]);
    for (const action of cites) {
      const links = read(path.join("actions", action)).match(
        /\[report-contract\.md\]\(\.\.\/references\/report-contract\.md\)/gu,
      );
      assert.equal(links?.length, 1, `${action} cites it once as a link`);
    }
  });

  it("the header says how it stays true as rounds are added", () => {
    const template = read("assets/review-template.md");
    assert.match(template, /^- Rounds: \{\{the count of round sections\}\}$/mu);
    assert.match(template, /^- Started: \{\{round 1's date, never changed\}\}$/mu);
  });

  it("a round's number and id come from the sections already present", () => {
    const heading = read("assets/review-template.md").match(/^## Round .+$/mu)?.[0] ?? "";
    assert.match(heading, /\{\{the count of round headings, this one included\}\}/u);
    assert.match(heading, /r-\{\{4 hex characters, drawn once\}\}/u, "two rounds appended in parallel still differ");
  });

  it("a finding carries no box, so no state of it can be copied", () => {
    const template = read("assets/review-template.md");
    assert.doesNotMatch(template.slice(template.indexOf("### Findings")), /^- \[[ x]\]/mu);
  });

  it("finalize checks the round against its declared shape before it ships", () => {
    assert.match(step("actions/05-finalize.md", "Check"), /Verify the round against the shape/u);
  });

  it("the template refuses a placeholder and an empty list", () => {
    assert.match(
      read("assets/review-template.md"),
      /Every placeholder is replaced by observed data, and a list no axis of this round owns is left out/u,
    );
  });

  it("a phase's projected files have one address", () => {
    const homes = everyMarkdown(SKILL, [])
      .filter((file) => /## Architecture projection/u.test(fs.readFileSync(file, "utf8")))
      .map(inSkill);
    assert.deepEqual(homes, ["actions/03-review-functional.md"]);
  });

  it("the closed field set and the template render the same round", () => {
    const validator = read("assets/review-validator.yml");
    const template = read("assets/review-template.md");
    const declared = validator.slice(validator.indexOf("fields:"), validator.indexOf("lists:"));
    const fields = [...declared.matchAll(/^ {2}- (\w+)/gmu)].map((match) => match[1]);
    assert.deepEqual(fields, ["Date", "By", "Diff", "Axes", "Verdict", "Score"]);
    const head = validator.slice(validator.indexOf("header:"), validator.indexOf("fields:"));
    const headerItems = [...head.matchAll(/^ {2}- (\w+)/gmu)].map((match) => match[1]);
    assert.deepEqual(headerItems, ["Rounds", "Started"]);
    for (const line of headerItems) {
      assert.match(template, new RegExp(`^- ${line}: `, "mu"), "the header renders what it declares");
    }
    const round = template.slice(template.indexOf("## Round"));
    const rendered = [...round.matchAll(/^- (\w+):/gmu)].map((match) => match[1]);
    assert.deepEqual(rendered, fields, "the round renders them all, in order, and nothing else");
  });

  it("the lists a round declares are the lists the template renders", () => {
    const validator = read("assets/review-validator.yml");
    const lists = [...validator.slice(validator.indexOf("lists:")).matchAll(/^ {2}- (\w+)/gmu)].map(
      (match) => match[1],
    );
    assert.deepEqual(lists, ["Criteria", "Findings"]);
    for (const list of lists) {
      assert.match(read("assets/review-template.md"), new RegExp(`^### ${list}$`, "mu"));
    }
  });

  it("a phase out of the diff has one line, and the template renders it", () => {
    assert.match(
      step("actions/03-review-functional.md", "Trace"),
      /untouched: out of the diff, no box/u,
    );
    assert.match(
      read("assets/review-template.md"),
      /^- Out of the diff: \{\{phase-name\}\} \(\{\{n\}\} criteria\)$/mu,
    );
  });

  it("a phase projecting no file is traced, not called out of the diff", () => {
    assert.match(
      step("actions/03-review-functional.md", "Trace"),
      /A phase projecting no file is traced, never out of the diff/u,
    );
  });

  it("an unmet criterion has one home, and it is not Findings", () => {
    assert.match(step("actions/03-review-functional.md", "Trace"), /unchecked, never a finding/u);
    const homes = everyMarkdown(SKILL, [])
      .filter((file) =>
        /(?:unmet|unchecked) criterion(?![^.]*no `Findings`)[^.]*`Findings`/u.test(
          fs.readFileSync(file, "utf8"),
        ),
      )
      .map(inSkill);
    assert.deepEqual(homes, []);
  });

  it("a context line of the diff is evidence, not only an added one", () => {
    assert.match(
      step("actions/03-review-functional.md", "Trace"),
      /Met by the files as the diff leaves them, an added line or a context line: checked/u,
    );
  });

  it("a label echoing the criterion is not evidence", () => {
    const body = read("actions/03-review-functional.md");
    assert.match(
      body.slice(body.indexOf("## Test")),
      /a name echoing it with no behaviour behind \| unchecked, naming the gap/u,
    );
  });

  it("a criterion whose subject is absent is a gap", () => {
    assert.match(
      step("actions/03-review-functional.md", "Trace"),
      /its subject absent[^:\n]*: unchecked/u,
    );
  });

  it("a criterion no diff could show is not-applicable, not a gap", () => {
    assert.match(
      step("actions/03-review-functional.md", "Trace"),
      /Its subject there, its property one no diff could ever show: checked, not-applicable/u,
    );
  });

  it("the severity scale is one scale: critical, major, minor", () => {
    assert.match(read("references/review-rubric.md"), /- 🟡 major: should fix\./u);
    assert.match(
      read("assets/review-template.md"),
      /\{\{🔴 critical \| 🟡 major \| 🟢 minor\}\}/u,
      "the template renders the scale the rubric names",
    );
    const strays = everyMarkdown(SKILL, [])
      .filter((file) => /\bwarning\b/iu.test(fs.readFileSync(file, "utf8")))
      .map(inSkill);
    assert.deepEqual(strays, [], "a severity the rubric does not name");
  });

  it("a critical is decided by the harm a merge would do, never by how strictly a rule is worded", () => {
    assert.match(
      read("references/review-rubric.md"),
      /^- 🔴 critical: would harm production, its users, their data or what depends on it; must not merge as-is\.$/mu,
    );
  });

  it("a round without functional is judged on its findings alone", () => {
    assert.match(
      read("references/review-rubric.md"),
      /A round without functional \| a verdict from its findings alone/u,
    );
  });

  it("a round with nothing in scope asks for changes, and never says approve", () => {
    const rubric = read("references/review-rubric.md");
    assert.match(rubric, /^\| `changes-requested` \| .*no criterion in scope \|$/mu);
    assert.match(rubric, /where functional ran, at least one criterion in scope and none unchecked/u);
    assert.doesNotMatch(rubric, /fixable critical/u, "one critical has one verdict");
  });

  it("no verdict of the skill is fixed: a round records no state of its own", () => {
    const homes = everyMarkdown(SKILL, [])
      .filter((file) => /`fixed`|\/ fixed\b/u.test(fs.readFileSync(file, "utf8")))
      .map(inSkill);
    assert.deepEqual(homes, []);
  });

  it("each axis owns its own vocabulary", () => {
    const owner = (pattern) =>
      everyMarkdown(SKILL, [])
        .filter((file) => pattern.test(fs.readFileSync(file, "utf8")))
        .map(inSkill);
    assert.deepEqual(owner(/`error-handling`/u), ["actions/02-review-code.md"]);
    assert.deepEqual(owner(/`rot`:/u), ["actions/04-review-relevancy.md"]);
  });

  it("the template renders every form a round can hold", () => {
    const template = read("assets/review-template.md");
    assert.match(template, /or not scored/u);
    assert.match(template, /not-applicable, \{\{why\}\}/u);
  });

  it("the score counts over the whole plan, and the template holds its form", () => {
    const score = step("actions/03-review-functional.md", "Score");
    assert.match(score, /whole criteria total/u, "the count is over the plan, not over what is in scope");
    assert.match(score, /met \+ unmet \+ out of the diff = the plan's whole criteria total/u, "and the three numbers are checkable against it");
    assert.match(score, /counts as met/u, "and a not-applicable criterion is counted");
    assert.doesNotMatch(score, /\{\{/u, "a rule names no template placeholder");
    assert.match(
      step("actions/03-review-functional.md", "Read"),
      /None to be had: not scored/u,
      "and a run with no criteria says so instead of scoring",
    );
    assert.match(
      read("assets/review-template.md"),
      /\{\{n_met\}\}\/\{\{n_plan\}\} met, \{\{n_unmet\}\} unmet, \{\{n_out\}\} out of the diff/u,
      "the form is rendered by the template, not spelled out in a rule",
    );
  });

  it("the router routes: it carries the flow, the actions and the rules, and nothing else", () => {
    const router = read("SKILL.md");
    const headings = [...router.matchAll(/^## (.+)$/gmu)].map((match) => match[1]);
    assert.deepEqual(headings, ["Actions", "Transversal rules"]);
    assert.match(router, /^\| Action \| Does \|$/mu, "the action table is the contract's own");
    const intro = router.slice(router.indexOf("## Actions") + 10, router.indexOf("| Action |")).trim();
    assert.equal(intro.split(/(?<=\.)\s/u).length, 1, "one sentence above the table, nothing more");
    for (const slug of ["prepare", "review-code", "review-functional", "review-relevancy", "finalize"]) {
      assert.match(router, new RegExp(`^\\| ${slug} \\| [a-z]`, "mu"), "each row is a bare slug");
    }
  });

  it("the flow draws every path a run can take", () => {
    const router = read("SKILL.md");
    const flow = router.slice(router.indexOf("```mermaid"), router.indexOf("## Actions"));
    for (const slug of ["prepare", "review-code", "review-functional", "review-relevancy", "finalize"]) {
      assert.match(flow, new RegExp(slug, "u"), "every action is a node");
    }
    for (const outcome of ["approve", "changes", "blocked"]) {
      assert.match(flow, new RegExp(`${outcome}\\(\\[`, "u"), "every verdict is a terminal node");
    }
    for (const outcome of ["changes", "blocked"]) {
      assert.match(flow, new RegExp(`^  ${outcome} -\\.->`, "mu"), "a verdict asking for work loops back");
    }
  });

  it("every action carries the contract's sections, and its test is a table", () => {
    for (const action of fs.readdirSync(path.join(SKILL, "actions"))) {
      const body = read(path.join("actions", action));
      const headings = [...body.matchAll(/^## (.+)$/gmu)].map((match) => match[1]);
      assert.deepEqual(headings, ["Input", "Output", "Process", "Test"], action);
      assert.match(body.slice(body.indexOf("## Test")), /^\| Case \| Pass \|$/mu, action);
    }
  });

  it("a review reads the code and never runs or fixes it", () => {
    assert.match(rules(), /^- Review statically: never run the app\.$/mu);
    assert.match(read("SKILL.md"), /Not for fixing what the review finds/u);
  });
});
