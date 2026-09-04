const assert = require("node:assert/strict");
const test = require("node:test");

const { parseFrontmatter } = require("../summarize-markdown.js");

const lfSkill = [
  "---",
  "name: 00-onboard",
  "description: Guide a project's journey through AIDD.",
  "argument-hint: project",
  "---",
  "",
  "# Onboard",
  "",
].join("\n");

test("parseFrontmatter reads description from LF frontmatter", () => {
  const { frontmatter } = parseFrontmatter(lfSkill);
  assert.equal(frontmatter.description, "Guide a project's journey through AIDD.");
});

test("parseFrontmatter reads description from CRLF frontmatter", () => {
  const { frontmatter } = parseFrontmatter(lfSkill.replaceAll("\n", "\r\n"));
  assert.equal(frontmatter.description, "Guide a project's journey through AIDD.");
});
