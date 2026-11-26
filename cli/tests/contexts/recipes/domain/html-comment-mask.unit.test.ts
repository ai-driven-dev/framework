import assert from "node:assert/strict";
import { test } from "vitest";
import { maskHtmlComments } from "../../../../src/contexts/recipes/domain/html-comment-mask.js";

test("an inline comment is blanked to spaces of the same width", () => {
  assert.equal(maskHtmlComments("a <!-- x --> b"), `a ${" ".repeat(10)} b`);
});

test("a comment spanning lines is blanked on every line it covers", () => {
  assert.equal(maskHtmlComments("a <!--\nx\n--> b"), "a     \n \n    b");
});

test("a comment-like text inside a fenced block stays as written", () => {
  const fenced = "```text\n<!-- example -->\n```";
  assert.equal(maskHtmlComments(fenced), fenced);
});

test("text after a closed fence is masked again", () => {
  assert.equal(maskHtmlComments("```text\n```\n<!--a-->"), `\`\`\`text\n\`\`\`\n${" ".repeat(8)}`);
});
