const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const SKILLS = path.resolve(__dirname, "../../plugins/aidd-dev/skills");

/**
 * An audit feeds refactor, and assert and review grade the same code: a finding keeps its severity
 * from one skill to the next only when every skill names the same three levels.
 */

function read(relative) {
  return fs.readFileSync(path.join(SKILLS, relative), "utf8");
}

function everyMarkdown(directory, into) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) everyMarkdown(full, into);
    else if (entry.name.endsWith(".md")) into.push(full);
  }
  return into;
}

describe("aidd-dev severities share one scale", () => {
  it("no skill names a severity the scale does not have", () => {
    const strays = everyMarkdown(SKILLS, [])
      .filter((file) => /\bwarning\b/iu.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SKILLS, file));
    assert.deepEqual(strays, []);
  });

  it("an audit counts and defines its findings as critical, major, minor", () => {
    const template = read("04-audit/assets/audit-template.md");
    assert.match(template, /\{\{n_critical\}\} critical, \{\{n_major\}\} major, \{\{n_minor\}\} minor/u);
    assert.match(template, /^- 🟡 major - /mu);
  });

  it("refactor reads an audit's findings on the same scale", () => {
    assert.match(read("07-refactor/SKILL.md"), /🔴 critical, 🟡 major, 🟢 minor/u);
  });

  it("an architecture violation is critical or major", () => {
    assert.match(read("03-assert/actions/02-assert-architecture.md"), /severity \(`critical` or `major`\)/u);
  });
});
