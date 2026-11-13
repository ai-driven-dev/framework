import assert from "node:assert/strict";
import { test } from "vitest";
import {
  headingAnchors,
  normalizedAnchor,
} from "../../../../src/contexts/recipes/domain/markdown-scan.js";
import { inspectRecipe } from "../../../../src/contexts/recipes/domain/recipe-rules.js";

const file = "recipe.md";
const command = "```bash\necho ready\n```";

function recipe(body = command, heading = "### 1) ✅ Check readiness") {
  return [
    "# Check readiness",
    "",
    "Check the environment before proceeding.",
    "",
    "## Steps to check readiness",
    "",
    heading,
    "",
    body,
  ].join("\n");
}

function finding(content: string, rule: string, line: number, fix: string) {
  assert.deepEqual(
    inspectRecipe(file, content).findings.filter((item) => item.rule === rule),
    [{ file, line, rule, fix }]
  );
}

test("heading anchors preserve Unicode and visible formatting text, with duplicate suffixes", () => {
  assert.deepEqual(
    [
      ...headingAnchors(
        "# **Café** `Ready`\n## Café Ready\n## Café Ready\n## **Under**-dash\n<!-- # Hidden -->\n```text\n# Fenced\n```"
      ),
    ],
    ["café-ready", "café-ready-1", "café-ready-2", "under-dash"]
  );
});

test("anchor normalization handles encoded Unicode, emoji modifiers, and malformed encoding", () => {
  assert.equal(normalizedAnchor("#CAF%C3%89"), "café");
  assert.equal(normalizedAnchor("#READY\u200d\ufe0e\ufe0f"), "ready");
  assert.equal(normalizedAnchor("#BAD%ZZ\u200d\ufe0e\ufe0f"), "bad%zz");
});

test("fences require a language and report the opening line", () => {
  finding(
    recipe("```\necho ready\n```"),
    "fence-language",
    9,
    "Add a language after the opening fence, such as ```bash or ```text."
  );
});

test("fences close only with the same marker, sufficient length, and no trailing text", () => {
  for (const closing of ["```", "~~~~", "````text"]) {
    finding(
      recipe(`\`\`\`\`bash\necho ready\n${closing}`),
      "fence-balance",
      9,
      "Close this fenced code block with the same marker."
    );
  }
  for (const body of ["````bash\necho ready\n`````", "~~~bash\necho ready\n~~~~"]) {
    assert.deepEqual(inspectRecipe(file, recipe(body)).findings, []);
  }
});

test("fence indentation and language metadata preserve JSON parsing", () => {
  for (const opening of ["```JSON", "   ```json extra-metadata"]) {
    const findings = inspectRecipe(file, recipe(`${opening}\n{broken}\n   \`\`\``)).findings;
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, "json-syntax");
    assert.equal(findings[0].line, 9);
    assert.match(findings[0].fix, /^Fix the JSON example: .+/u);
  }
});

test("fenced headings and links are examples rather than document structure or targets", () => {
  const inspection = inspectRecipe(
    file,
    recipe("```text\n# Fake title\n## Steps to fake it\n[draft](missing.md)\n```")
  );
  assert.deepEqual(inspection.findings, []);
  assert.deepEqual(inspection.links, []);
  assert.deepEqual(
    [...inspection.anchors],
    ["check-readiness", "steps-to-check-readiness", "1--check-readiness"]
  );
});

test("local links retain line, target, and image identity; external schemes are ignored", () => {
  const inspection = inspectRecipe(
    file,
    `${recipe()}\n[notes](<reference notes.md> "Notes")\n![state](ready.png 'Ready')\n[web](HTTPS://example.com) [mail](mailto:a@example.com) [call](tel:123) [app](codex:open)`
  );
  assert.deepEqual(inspection.links, [
    { line: 12, target: "reference notes.md", image: false },
    { line: 13, target: "ready.png", image: true },
  ]);
});

// Raw HTML is publishable Markdown, not unfinished scaffold. CommonMark 0.31.2
// §6.6 permits attributes, uppercase names, and self-closing tags:
