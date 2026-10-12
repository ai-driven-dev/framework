import assert from "node:assert/strict";
import { test } from "vitest";
import { inspectRecipe } from "../../../../../src/contexts/framework/domain/recipes/recipe-validation.js";

const file = "publish.md";
const example = "```bash\necho ready\n```";

function document(step: string, introduction = "Publish an observable result.") {
  return `# Publish\n\n${introduction}\n\n## Steps to publish\n\n${step}`;
}

function findings(content: string, rule: string) {
  return inspectRecipe(file, content).findings.filter((item) => item.rule === rule);
}

test("skipped headings name the next available level at the offending line", () => {
  assert.deepEqual(findings(document(`#### 1) ✅ Publish\n${example}`), "heading-depth"), [
    {
      file,
      line: 7,
      rule: "heading-depth",
      fix: "Use level 3 or shallower after the previous heading.",
    },
  ]);
});

test.each(["```", "~~~~", "````text", "prefix ````", "````   text"])(
  "a non-closing %s fence leaves HTML comments visible as published code",
  (closing) => {
    const content = document(`### 1) ✅ Publish\n\`\`\`\`text\n${closing}\n<!-- TODO -->`);
    assert.deepEqual(findings(content, "todo"), [
      {
        file,
        line: 10,
        rule: "todo",
        fix: "Resolve this unfinished marker before publishing the recipe.",
      },
    ]);
    assert.equal(findings(content, "fence-balance").length, 1);
  }
);

test("a closing fence with trailing whitespace allows subsequent comments to be hidden", () => {
  assert.deepEqual(
    inspectRecipe(file, document("### 1) ✅ Publish\n```text\nready\n```   \n<!-- TODO -->"))
      .findings,
    []
  );
});

test("inline and multiline comments preserve visible markers and local link lines", () => {
  const content = document(
    `### 1) ✅ Publish\n${example}\n[Before](before.md) <!-- TODO [Draft](draft.md) --> [After](after.md)\n<!-- hidden\nTODO\n--> {{command}}`
  );
  const inspection = inspectRecipe(file, content);
  assert.deepEqual(inspection.links, [
    { line: 11, target: "before.md", image: false },
    { line: 11, target: "after.md", image: false },
  ]);
  assert.deepEqual(inspection.findings, [
    {
      file,
      line: 14,
      rule: "placeholder",
      fix: "Replace or remove this template placeholder.",
    },
  ]);
});

test("whitespace before a fence language does not bypass JSON validation", () => {
  const result = inspectRecipe(
    file,
    document("### 1) ✅ Publish\n```  JSON  metadata\n{broken}\n```")
  ).findings;
  assert.equal(result.length, 1);
  assert.equal(result[0].rule, "json-syntax");
  assert.equal(result[0].line, 8);
  assert.match(result[0].fix, /^Fix the JSON example: .+/u);
});

test("short inline code and tildes do not open fences that expose draft comments", () => {
  for (const line of ["`literal`", "~literal~"]) {
    assert.deepEqual(
      inspectRecipe(file, document(`### 1) ✅ Publish\n${example}\n${line}\n<!-- TODO -->`))
        .findings,
      []
    );
  }
});

test("steps are numbered only inside their outcome section", () => {
  const content = `# Publish\n\nPublish an observable result.\n\n## Why\n\n### 8) 📝 Earlier context\n\nExplain when to publish.\n\n## Steps to publish\n\n### 1) ✅ Publish\n${example}\n\n## Verify\n\n### 9) 🔬 Later reference\n\nExplain how to inspect the result.`;
  assert.deepEqual(inspectRecipe(file, content).findings, []);
});

test("headings mentioning Steps or Verify do not declare those sections", () => {
  const content = document(`### 1) ✅ Publish\n${example}`).replace(
    "## Steps to publish",
    "## Before Verify\n\nContext.\n\n## Steps to  publish"
  );
  assert.deepEqual(inspectRecipe(file, `${content}\n\n## Further Steps to consider`).findings, []);
});

test("step headings allow spacing between the number, emoji and title", () => {
  assert.deepEqual(inspectRecipe(file, document(`### 1)   ✅   Publish\n${example}`)).findings, []);
});

test("number-like category names and malformed multi-digit steps stay distinct", () => {
  const content = document(`### Release 12 notes\n\n#### 1) ✅ Publish\n${example}`);
  assert.deepEqual(inspectRecipe(file, content).findings, []);
  for (const heading of ["### 12 Publish", "### 12. Publish"]) {
    assert.deepEqual(findings(document(heading), "step-heading"), [
      {
        file,
        line: 7,
        rule: "step-heading",
        fix: "Use `### N) <emoji> Title`, or `#### N) <emoji> Title` below a category.",
      },
    ]);
  }
});

test("a prior step's closing fence cannot supply the next step's example", () => {
  assert.deepEqual(
    findings(
      document(`### 1) ✅ Publish\n${example}\n### 2) 🔬 Inspect\nExplain the result.`),
      "step-example"
    ),
    [
      {
        file,
        line: 11,
        rule: "step-example",
        fix: "Add a fenced command/config/output, a concrete table, or an operational image.",
      },
    ]
  );
});

test("table examples permit indentation, alignment and omitted separator-edge pipes", () => {
  for (const table of [
    "  | State | Meaning |  \n  | :--- | ---: |\n  | ready | Proceed |",
    "| State | Meaning |\n--- | ---\nready | Proceed",
  ]) {
    assert.deepEqual(inspectRecipe(file, document(`### 1) ✅ Publish\n${table}`)).findings, []);
  }
});

test.each([
  "Prose | State | Meaning |\n| --- | --- |",
  "| State | Meaning | trailing prose\n| --- | --- |",
  "| State | Meaning |\nProse | --- | --- |",
  "| State | Meaning |\n| - | - |",
])("a malformed table cannot stand in for a concrete example: %s", (table) => {
  assert.deepEqual(findings(document(`### 1) ✅ Publish\n${table}`), "step-example"), [
    {
      file,
      line: 7,
      rule: "step-example",
      fix: "Add a fenced command/config/output, a concrete table, or an operational image.",
    },
  ]);
});

test("description validation ignores whitespace-only lines and reports indented lists", () => {
  const content = document(`### 1) ✅ Publish\n${example}`, "  \n   12. Publish the result.");
  assert.deepEqual(findings(content, "description"), [
    {
      file,
      line: 4,
      rule: "description",
      fix: "Put a non-empty plain description paragraph directly after the H1.",
    },
  ]);
});

test("a scheme inside a local link fragment does not make the target external", () => {
  assert.deepEqual(
    inspectRecipe(
      file,
      document(`### 1) ✅ Publish\n${example}\n[Notes](reference.md#https:section   "Details")`)
    ).links,
    [{ line: 11, target: "reference.md#https:section", image: false }]
  );
});

test("URL autolinks stay concrete while angle placeholders containing URL text are rejected", () => {
  const content = document(
    `### 1) ✅ Publish\n${example}\n<http://example.com> <paste https://example.com>`
  );
  assert.deepEqual(findings(content, "placeholder"), [
    {
      file,
      line: 11,
      rule: "placeholder",
      fix: "Replace or remove this angle-bracket placeholder.",
    },
  ]);
});
