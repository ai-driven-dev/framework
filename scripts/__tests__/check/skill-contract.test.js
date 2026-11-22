const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const ENGINE = path.resolve(__dirname, "../../../plugins/aidd-context/skills/04-skill-generate/scripts/validate-skill.cjs");

/**
 * The generator's lexical gate: a clean skill passes, each rule has the one mutation that makes
 * it fail, and the skills the generator produced in this tree pass with no finding at all.
 */

const CLEAN = {
  "SKILL.md": [
    "---",
    "name: demo",
    "description: Demonstrates a skill, when the user wants a demo.",
    "---",
    "",
    "# Demo",
    "",
    "```mermaid",
    "flowchart LR",
    '  entry([request]) --> first["actions/01-first.md"] --> second["actions/02-second.md"]',
    "  second --> done((done))",
    "```",
    "",
    "## Transversal rules",
    "",
    "- Speak only to ask.",
    "",
  ].join("\n"),
  "actions/01-first.md": [
    "# 01 - First",
    "",
    "Gather the request.",
    "",
    "## Input",
    "",
    "The request.",
    "",
    "## Process",
    "",
    "1. Read the request against [the rubric](../references/rubric.md).",
    "2. Read [second](02-second.md).",
    "",
    "## Output",
    "",
    "The gathered request.",
    "",
  ].join("\n"),
  "actions/02-second.md": ["# 02 - Second", "", "Answer.", "", "## Process", "", "1. Answer per the rubric.", "", "## Output", "", "The answer.", ""].join("\n"),
  "references/rubric.md": ["# Rubric", "", "| Case | Answer |", "| --- | --- |", "| any | yes |", ""].join("\n"),
};

let base;
let root;

function write(files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
}

function run(skill = root, ...extra) {
  const result = spawnSync(process.execPath, [ENGINE, skill, ...extra], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

function mutate(file, from, to) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  assert.ok(text.includes(from), `fixture lacks ${from}`);
  fs.writeFileSync(full, text.replace(from, to));
}

const RULES = {"description": "SKILL-0[1-4]", "router": "SKILL-05", "diagram": "SKILL-06", "edge": "SKILL-07", "heading": "SKILL-0[89]", "read-next": "SKILL-10", "sentence": "SKILL-11", "rule-line": "SKILL-12", "length": "SKILL-13", "slot": "SKILL-1[45]", "bold": "SKILL-16", "citation": "SKILL-17", "folder name": "SKILL-18", "no name": "SKILL-18", "no description": "SKILL-20", "outside link": "SKILL-21", "sibling": "SKILL-22"};

function expectError(rule) {
  const { code, out } = run();
  assert.equal(code, 1, out);
  assert.match(out, new RegExp(` ${RULES[rule]} `, "u"), out);
}

describe("skill check", () => {
  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "skill-check-"));
    root = path.join(base, "plugins/aidd-demo/skills/demo");
    write(CLEAN);
  });
  afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

  it("passes a clean skill silently", () => {
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("refuses a folder with no SKILL.md with exit 2, so a usage error never reads as findings", () => {
    const { code, err } = run(path.join(root, "actions"));
    assert.equal(code, 2);
    assert.match(err, /SKILL\.md: missing/u);
  });

  it("refuses a call with no folder with exit 2", () => {
    const result = spawnSync(process.execPath, [ENGINE], { encoding: "utf8" });
    assert.equal(result.status, 2);
  });

  it("description: a description over 150 characters", () => {
    mutate("SKILL.md", "wants a demo.", `wants a demo${" and more".repeat(20)}.`);
    expectError("description");
  });

  it("description: a colon in the description", () => {
    mutate("SKILL.md", "Demonstrates a skill,", "Demonstrates: a skill,");
    expectError("description");
  });

  it("description: a dash separator in the description", () => {
    mutate("SKILL.md", "Demonstrates a skill,", "Demonstrates a skill -");
    expectError("description");
  });

  it("description: two sentences in the description", () => {
    mutate("SKILL.md", "wants a demo.", "wants a demo. Not for prod.");
    expectError("description");
  });

  it("router: a heading besides the transversal rules", () => {
    mutate("SKILL.md", "## Transversal rules", "## Actions\n\n## Transversal rules");
    expectError("router");
  });

  it("diagram: an action file the diagram does not draw", () => {
    write({ "actions/03-third.md": "# 03 - Third\n\nEnd.\n\n## Process\n\n1. End.\n" });
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n2. Read [third](03-third.md).");
    expectError("diagram");
  });

  it("diagram: a diagram that is not flowchart LR", () => {
    mutate("SKILL.md", "flowchart LR", "flowchart TD");
    expectError("diagram");
  });

  it("diagram: a reference drawn as a box", () => {
    mutate("SKILL.md", "second --> done((done))", 'second --> persist["persistence"] --> done((done))');
    expectError("diagram");
  });

  it("diagram: a file path drawn as a bare node", () => {
    mutate("SKILL.md", "second --> done((done))", "second --> references/rubric.md --> done((done))");
    expectError("diagram");
  });

  it("edge: a node leaving by two edges without a condition", () => {
    mutate("SKILL.md", "second --> done((done))", "second --> done((done))\n  second --> stopped((stopped))");
    expectError("edge");
  });

  it("edge: an edge between actions that the source action never takes", () => {
    mutate("actions/01-first.md", "2. Read [second](02-second.md).", "2. Stop.");
    expectError("edge");
  });

  for (const arrow of ["-.->", "==>", '-.->|"next"|', '==>|"next"|']) {
    it(`edge: a ${arrow} edge between actions is held to the same link`, () => {
      mutate("SKILL.md", 'first["actions/01-first.md"] -->', `first["actions/01-first.md"] ${arrow}`);
      mutate("actions/01-first.md", "2. Read [second](02-second.md).", "2. Stop.");
      expectError("edge");
    });
  }

  it("edge: an unlabeled two-way edge leaves both of its nodes", () => {
    mutate("SKILL.md", "second --> done((done))", "user((user)) <--> second\n  second --> done((done))");
    expectError("edge");
  });

  it("edge: an edge drawn in a grouped source passes when each source links its target", () => {
    write({ "actions/02-second.md": "# 02 - Second\n\nAnswer.\n\n## Process\n\n1. Answer, or read [third](03-third.md).\n", "actions/03-third.md": "# 03 - Third\n\nEnd.\n\n## Process\n\n1. End.\n" });
    mutate("actions/01-first.md", "2. Read [second](02-second.md).", "2. Read [second](02-second.md), or [third](03-third.md).");
    mutate("SKILL.md", "second --> done((done))", 'first & second -->|"skip"| third["actions/03-third.md"]\n  second --> done((done))');
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("edge: an edge a transversal rule takes passes without a link in the source action", () => {
    write({ "actions/03-third.md": "# 03 - Third\n\nEnd.\n\n## Process\n\n1. End.\n" });
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n2. Read [third](03-third.md).");
    mutate("SKILL.md", "second --> done((done))", 'second --> third["actions/03-third.md"] --> done((done))\n  first -->|"user stops"| third');
    mutate("SKILL.md", "- Speak only to ask.", "- Speak only to ask.\n- When the user stops, go to third.");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("edge: a self-loop needs no link", () => {
    mutate("SKILL.md", "second --> done((done))", 'second -->|"again"| second\n  second --> done((done))');
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("heading: a section outside the fixed set", () => {
    mutate("actions/02-second.md", "## Output", "## Test\n\nIt works.\n\n## Output");
    expectError("heading");
  });

  it("heading: sections out of order", () => {
    mutate("actions/01-first.md", "## Input\n\nThe request.\n\n", "");
    mutate("actions/01-first.md", "## Output\n\nThe gathered request.\n", "## Output\n\nThe gathered request.\n\n## Input\n\nThe request.\n");
    expectError("heading");
  });

  it("heading: a title without its number", () => {
    mutate("actions/01-first.md", "# 01 - First", "# First");
    expectError("heading");
  });

  it("read-next: a non-terminal action whose last step does not read the next", () => {
    mutate("actions/01-first.md", "2. Read [second](02-second.md).", "2. Stop here.");
    expectError("read-next");
  });

  it("length: an action of 100 lines or more", () => {
    mutate("actions/02-second.md", "The answer.", `The answer.${"\n".repeat(100)}`);
    expectError("length");
  });

  it("length: a reference of 100 lines or more", () => {
    mutate("references/rubric.md", "| any | yes |", Array.from({ length: 100 }, (_, i) => `| c${i} | yes |`).join("\n"));
    expectError("length");
  });

  it("citation: a link to a file that does not exist", () => {
    mutate("actions/01-first.md", "../references/rubric.md", "../references/missing.md");
    expectError("citation");
  });

  it("folder name: a name other than the folder's", () => {
    mutate("SKILL.md", "name: demo", "name: other");
    expectError("folder name");
  });

  it("no name: an empty name", () => {
    mutate("SKILL.md", "name: demo", "name:");
    expectError("no name");
  });

  it("no description: an empty description", () => {
    mutate("SKILL.md", "description: Demonstrates a skill, when the user wants a demo.", "description:");
    expectError("no description");
  });

  it("outside link: a link leaving the skill, even in an asset", () => {
    write({ "assets/answer.md": "# Answer\n\n[out](../../../README.md)\n" });
    expectError("outside link");
  });

  it("citation: a dead link in an asset is no finding", () => {
    write({ "assets/answer.md": "# Answer\n\n[next](./phase-1.md)\n" });
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("sibling: a skill of a sibling plugin named in a reference, but not the plugin's own or an asset's", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | /aidd-demo:02-own |");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
    write({ "assets/answer.md": "Run /aidd-dev:01-plan.\n" });
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
    mutate("references/rubric.md", "/aidd-demo:02-own", "/aidd-dev:01-plan");
    expectError("sibling");
  });

  it("a second link to the same file is no finding", () => {
    mutate("actions/01-first.md", "1. Read", "1. Check [the rubric](../references/rubric.md).\n2. Read");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("a date or a ticket id is no finding, the skill's content is its owner's", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | yes, since 2026-11, see #1234 |");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("read-next: a last step linking the next action with a ./ prefix passes", () => {
    mutate("actions/01-first.md", "(02-second.md)", "(./02-second.md)");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("slot: a comment outside an asset", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n<!-- answer briefly -->");
    expectError("slot");
  });

  it("slot: a comment closed the way HTML also accepts, --!>", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n<!-- answer briefly --!>");
    expectError("slot");
  });

  it("quotes an excerpt as JSON so it reads back exactly", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", '1. **a\\"b**');
    const quoted = run().out.match(/ SKILL-16 .* ("1\. .*")$/mu);
    assert.ok(quoted);
    assert.equal(JSON.parse(quoted[1]), '1. **a\\"b**');
  });

  it("slot: a template slot left unfilled outside an asset", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. {{step}}");
    expectError("slot");
  });

  it("read-next: an action the diagram only ends needs no read-next step, wherever it sorts", () => {
    mutate("SKILL.md", '  entry([request]) --> first["actions/01-first.md"] --> second["actions/02-second.md"]\n  second --> done((done))', '  entry([request]) -->|"one"| first["actions/01-first.md"] --> done((done))\n  entry -->|"two"| second["actions/02-second.md"] --> done');
    mutate("actions/01-first.md", "2. Read [second](02-second.md).", "2. Answer.");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("slot: a comment shown inside a code block passes", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | yes |\n\n```\n<!-- example -->\n```");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("slot: a comment inside an asset passes", () => {
    write({ "assets/answer.md": "# Answer\n\n<!-- one line per finding -->\n" });
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("a boundary kept with never is no finding", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Never answer outside the rubric.");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("bold: bold", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. **Answer** per the rubric.");
    expectError("bold");
  });

  it("a long sentence is no finding", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", `1. Answer ${"word ".repeat(30)}per the rubric.`);
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("sentence: two sentences in a step, with a way out for text kept exact", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric. Write nothing else.");
    expectError("sentence");
    assert.match(run().out, /backticks/u);
  });

  it("sentence: two sentences in a case of a step", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n   - No rubric: ask for one. Then stop.");
    expectError("sentence");
  });

  it("sentence: two clauses joined by a semicolon in a step", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric; write nothing else.");
    expectError("sentence");
  });

  it("sentence: two sentences in a transversal rule", () => {
    mutate("SKILL.md", "- Speak only to ask.", "- Speak only to ask. Wait after.");
    expectError("sentence");
  });

  it("sentence: two sentences in an action rule", () => {
    mutate("actions/02-second.md", "The answer.\n", "The answer.\n\n## Rules\n\n- Answer once; never twice.\n");
    expectError("sentence");
  });

  it("rule-line: a sub-item under a transversal rule", () => {
    mutate("SKILL.md", "- Speak only to ask.", "- Speak only to ask.\n  - In a subagent: ask the caller.");
    expectError("rule-line");
  });

  it("rule-line: a sub-item under an action rule", () => {
    mutate("actions/02-second.md", "The answer.\n", "The answer.\n\n## Rules\n\n- Answer once.\n  - Asked twice: repeat it.\n");
    expectError("rule-line");
  });

  it("a case of a step as a dash sub-item is no finding", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n   - No rubric: ask for one.");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("sentence: an abbreviation like e.g. ends no sentence", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per a rubric (e.g. the team's, i.e. the shared one).");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("sentence: a period inside inline code or a link target is no finding", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per [the rubric](../references/rubric.md) with `a. b`.");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("sentence: several sentences outside the process are no finding", () => {
    mutate("actions/02-second.md", "Answer.", "Answer. Then stop.");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("skips code: fenced blocks and inline code hold no finding", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | `**never** 2026-11` |\n\n```\n**never** [x](missing.md)\n```");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("reads a skill saved with CRLF line endings like one saved with LF", () => {
    for (const file of Object.keys(CLEAN)) fs.writeFileSync(path.join(root, file), CLEAN[file].replace(/\n/gu, "\r\n"));
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
    mutate("actions/02-second.md", "Answer per", "**Answer** per");
    const { code, out } = run();
    assert.equal(code, 1, out);
    assert.match(out, / SKILL-16 /u);
    assert.doesNotMatch(out, / SKILL-06 /u);
  });

  it("exits 2, not 1, when a file of the skill cannot be read, so a crash never reads as findings", () => {
    fs.symlinkSync(path.join(root, "missing.md"), path.join(root, "references/broken.md"));
    const { code, out, err } = run();
    assert.equal(code, 2, out);
    assert.match(err, /broken\.md/u);
  });

  for (const skill of ["aidd-context/skills/04-skill-generate", "aidd-dev/skills/05-review"]) {
    it(`finds nothing in ${skill}`, () => {
      assert.deepEqual(run(path.resolve(__dirname, "../../../plugins", skill)), { code: 0, out: "", err: "" });
    });
  }
});
