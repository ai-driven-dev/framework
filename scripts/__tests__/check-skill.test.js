const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const GENERATOR = path.resolve(__dirname, "../../plugins/aidd-context/skills/04-skill-generate");
const SCRIPT = path.join(GENERATOR, "scripts/check-skill.cjs");

/**
 * The check is the lexical half of the generator's validation: a clean skill passes, each rule has
 * the one mutation that makes it fail, and the skills the generator produced in this tree pass with
 * no finding at all.
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

function run(skill = root) {
  const result = spawnSync(process.execPath, [SCRIPT, skill], { encoding: "utf8" });
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

describe("check-skill", () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "check-skill-"));
    write(CLEAN);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("passes a clean skill silently", () => {
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  it("refuses a folder with no SKILL.md, readably", () => {
    const { code, err } = run(path.join(root, "actions"));
    assert.equal(code, 1);
    assert.match(err, /usage: check-skill\.cjs <skill-folder>/u);
  });

  it("R3: a description over 150 characters", () => {
    mutate("SKILL.md", "wants a demo.", `wants a demo${" and more".repeat(20)}.`);
    expectError("R3");
  });

  it("R3: a colon in the description", () => {
    mutate("SKILL.md", "Demonstrates a skill,", "Demonstrates: a skill,");
    expectError("R3");
  });

  it("R3: two sentences in the description", () => {
    mutate("SKILL.md", "wants a demo.", "wants a demo. Not for prod.");
    expectError("R3");
  });

  it("R7: a heading besides the transversal rules", () => {
    mutate("SKILL.md", "## Transversal rules", "## Actions\n\n## Transversal rules");
    expectError("R7");
  });

  it("R8: an action file the diagram does not draw", () => {
    write({ "actions/03-third.md": "# 03 - Third\n\nEnd.\n\n## Process\n\n1. End.\n" });
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. Answer per the rubric.\n2. Read [third](03-third.md).");
    expectError("R8");
  });

  it("R8: a diagram that is not flowchart LR", () => {
    mutate("SKILL.md", "flowchart LR", "flowchart TD");
    expectError("R8");
  });

  it("R10: a transversal rule copied from the generator", () => {
    mutate("SKILL.md", "- Speak only to ask.", "- Announce intended writes before editing.");
    expectError("R10");
  });

  it("R12: a section outside the fixed set", () => {
    mutate("actions/02-second.md", "## Output", "## Test\n\nIt works.\n\n## Output");
    expectError("R12");
  });

  it("R12: sections out of order", () => {
    mutate("actions/01-first.md", "## Input\n\nThe request.\n\n", "");
    mutate("actions/01-first.md", "## Output\n\nThe gathered request.\n", "## Output\n\nThe gathered request.\n\n## Input\n\nThe request.\n");
    expectError("R12");
  });

  it("R12: a title without its number", () => {
    mutate("actions/01-first.md", "# 01 - First", "# First");
    expectError("R12");
  });

  it("R13: a non-terminal action whose last step does not read the next", () => {
    mutate("actions/01-first.md", "2. Read [second](02-second.md).", "2. Stop here.");
    expectError("R13");
  });

  it("R16: an action of 100 lines or more", () => {
    mutate("actions/02-second.md", "The answer.", `The answer.${"\n".repeat(100)}`);
    expectError("R16");
  });

  it("R19: a reference of 100 lines or more", () => {
    mutate("references/rubric.md", "| any | yes |", Array.from({ length: 100 }, (_, i) => `| c${i} | yes |`).join("\n"));
    expectError("R19");
  });

  it("R23: a link to a file that does not exist", () => {
    mutate("actions/01-first.md", "../references/rubric.md", "../references/missing.md");
    expectError("R23");
  });

  it("R23: a second link to the same file", () => {
    mutate("actions/01-first.md", "1. Read", "1. Check [the rubric](../references/rubric.md).\n2. Read");
    expectError("R23");
  });

  it("R30: a date", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | yes, since 2026-11 |");
    expectError("R30");
  });

  it("R31: bold", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", "1. **Answer** per the rubric.");
    expectError("R31");
  });

  it("R28 and R26 only warn", () => {
    mutate("actions/02-second.md", "1. Answer per the rubric.", `1. Never answer ${"word ".repeat(30)}per the rubric.`);
    const { code, out } = run();
    assert.equal(code, 0, out);
    assert.match(out, / R28 warning /u);
    assert.match(out, / R26 warning /u);
  });

  it("skips code: fenced blocks and inline code hold no finding", () => {
    mutate("references/rubric.md", "| any | yes |", "| any | `**never** 2026-11` |\n\n```\n**never** [x](missing.md)\n```");
    assert.deepEqual(run(), { code: 0, out: "", err: "" });
  });

  for (const skill of ["aidd-context/skills/04-skill-generate", "aidd-dev/skills/05-review", "aidd-context/skills/08-hook-generate"]) {
    it(`finds nothing in ${skill}`, () => {
      assert.deepEqual(run(path.resolve(__dirname, "../../plugins", skill)), { code: 0, out: "", err: "" });
    });
  }
});
