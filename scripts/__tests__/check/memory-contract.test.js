const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings } = require("./helpers.js");

const CONTRACT = path.resolve(__dirname, "../../check/contracts/memory.json");
const SKILL = path.resolve(__dirname, "../../../plugins/aidd-context/skills/02-project-memory");

/** The shipped skill, copied: every MEMORY rule is silent on it, each mutation wakes one. */
let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-contract-"));
  fs.cpSync(SKILL, dir, { recursive: true });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const edit = (file, change) => {
  const target = path.join(dir, file);
  fs.writeFileSync(target, change(fs.readFileSync(target, "utf8")));
};
const ids = () => [...new Set(findings(CONTRACT, dir).map((found) => found.id))];

describe("memory contract", () => {
  it("accepts the shipped skill", () => {
    assert.deepEqual(findings(CONTRACT, dir), []);
  });

  it("MEMORY-01 flags a rule row that differs from the engine, and a missing one", () => {
    edit("references/memory-rules.md", (text) => text.replace("| 25 words |", "| 26 words |"));
    assert.deepEqual(ids(), ["MEMORY-01"]);
    edit("references/memory-rules.md", (text) => text.replace(/^\| M2 \|.*\n/mu, ""));
    assert.deepEqual(ids(), ["MEMORY-01"]);
  });

  it("MEMORY-02 flags a word limit stated outside the table", () => {
    edit("SKILL.md", (text) => `${text}\nKeep it under 30 words.\n`);
    assert.deepEqual(ids(), ["MEMORY-02"]);
  });

  it("MEMORY-03 flags a README template the engine rejects", () => {
    edit("assets/templates/README.md", (text) => `${text}\nSee \`aidd_docs/nothing-here.md\`.\n`);
    assert.deepEqual(ids(), ["MEMORY-03"]);
  });

  it("MEMORY-04 flags a memory template with an error besides its questions, and one with no question", () => {
    edit("assets/templates/memory/api.md", (text) => `${text}\n- See \`aidd_docs/nothing-here.md\`.\n`);
    assert.deepEqual(ids(), ["MEMORY-04"]);
    fs.writeFileSync(path.join(dir, "assets/templates/memory/api.md"), "# API\n\n## Surface\n\n- Plain.\n");
    assert.deepEqual(ids(), ["MEMORY-04"]);
  });

  it("MEMORY-05 flags a guidance comment and a TODO left in a template", () => {
    edit("assets/templates/memory/api.md", (text) => `${text}\n<!-- guidance -->\n`);
    assert.deepEqual(ids(), ["MEMORY-05"]);
    edit("assets/templates/memory/api.md", (text) => text.replace("<!-- guidance -->", "TODO"));
    assert.deepEqual(ids(), ["MEMORY-05"]);
  });

  it("MEMORY-06 flags a template no row names, and a name with no template", () => {
    edit("references/capabilities.md", (text) => text.replace("`api.md`", "`apix.md`"));
    assert.deepEqual(ids(), ["MEMORY-06"]);
  });

  it("MEMORY-07 flags a command line in the skill text", () => {
    edit("SKILL.md", (text) => `${text}\nRun \`node x.cjs\`.\n`);
    assert.deepEqual(ids(), ["MEMORY-07"]);
  });
});
