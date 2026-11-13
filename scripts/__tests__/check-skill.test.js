const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const ENGINE = path.resolve(__dirname, "../../plugins/aidd-context/skills/04-skill-generate/scripts/check-skill.cjs");

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

function expectError(rule) {
  const { code, out } = run();
  assert.equal(code, 1, out);
  assert.match(out, new RegExp(` ${rule}[ "]`, "u"), out);
}

describe("skill check", () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-check-"));
    write(CLEAN);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("passes a clean skill silently", () => {
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("refuses a folder with no SKILL.md with exit 2, so a usage error never reads as findings", () => {
    const { code, err } = run(path.join(root, "actions"));
    assert.equal(code, 2);
    assert.match(err, /usage: check-skill\.cjs <skill-folder>/u);
  });

  it("refuses a call with no folder with exit 2", () => {
    const result = spawnSync(process.execPath, [ENGINE], { encoding: "utf8" });
    assert.equal(result.status, 2);
  });

  it("heads its findings with the skill it checked, never a plugin of its own", () => {
    mutate("SKILL.md", "wants a demo.", "wants a demo. Not for prod.");
    const { out } = run();
    assert.equal(out.split("\n")[0], `${path.basename(root)}: 1 error`);
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

  it("citation: a second link to the same file", () => {
    mutate("actions/01-first.md", "1. Read", "1. Check [the rubric](../references/rubric.md).\n2. Read");
    expectError("citation");
  });

  it("date: a date", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | yes, since 2026-11 |");
    expectError("date");
  });

  it("date: a ticket id", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | yes, see #1234 |");
    expectError("date");
  });

  it("date: a link to a numbered heading is no ticket id", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | [ten](#10-plan) |");
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

  it("slot: a template slot left unfilled outside an asset", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. <step>");
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

  it("skips code: fenced blocks and inline code hold no finding", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | `**never** 2026-11` |\n\n```\n**never** [x](missing.md)\n```");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  for (const skill of ["aidd-context/skills/04-skill-generate"]) {
    it(`finds nothing in ${skill}`, () => {
      assert.deepEqual(run(path.resolve(__dirname, "../../plugins", skill)), { code: 0, out: "", err: "" });
    });
  }
});
