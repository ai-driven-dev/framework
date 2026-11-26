import assert from "node:assert/strict";
import { test } from "vitest";
import {
  findAnglePlaceholders,
  maskAngleSyntaxBlocks,
} from "../../../../src/contexts/recipes/domain/angle-placeholders.js";

const none = new Set<number>();

function found(content: string, fenced = none): string[] {
  return findAnglePlaceholders(content, fenced).map((match) => match[0]);
}

test("an angle placeholder in prose is reported", () => {
  assert.deepEqual(found("Run <your command> now"), ["<your command>"]);
});

test("known HTML tags, closed tags and URL autolinks are concrete syntax", () => {
  assert.deepEqual(found("<br> <kbd>x</kbd> <custom>a</custom> <https://example.com>"), []);
});

test("an HTML tag with a bare phrase after its name is still a placeholder", () => {
  assert.deepEqual(found("<div the reader>"), ["<div the reader>"]);
});

test("an angle-wrapped link destination is Markdown syntax outside fences", () => {
  assert.deepEqual(found("[a](<my file.md>)"), []);
  assert.deepEqual(found("[a](<my file.md>)", new Set([0])), ["<my file.md>"]);
});

test("angle syntax inside a fenced xml block is blanked unless it is a template phrase", () => {
  const block = { start: 0, end: 3, language: "xml", marker: "`", length: 3, body: "" };
  const content = "```xml\n<node attr>\n<recipe title>\n```";
  assert.equal(
    maskAngleSyntaxBlocks(content, [block]),
    `\`\`\`xml
${" ".repeat(11)}
<recipe title>
\`\`\``
  );
});

test("a block in another language is left untouched", () => {
  const block = { start: 0, end: 2, language: "bash", marker: "`", length: 3, body: "" };
  const content = "```bash\n<node attr>\n```";
  assert.equal(maskAngleSyntaxBlocks(content, [block]), content);
});
