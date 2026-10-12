import assert from "node:assert/strict";
import { test } from "vitest";
import {
  headingAnchors,
  inspectRecipe,
  normalizedAnchor,
} from "../../../../../src/contexts/framework/domain/recipes/recipe-validation.js";

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

test("numbered steps require an emoji and the documented heading syntax", () => {
  finding(
    recipe(command, "### 1) plain Check readiness"),
    "step-emoji",
    7,
    "Add one meaningful emoji between the step number and title."
  );
  finding(
    recipe(command, "### 1. ✅ Check readiness"),
    "step-heading",
    7,
    "Use `### N) <emoji> Title`, or `#### N) <emoji> Title` below a category."
  );
});

test("an empty steps section reports where a step must be added", () => {
  finding(
    recipe().split("\n").slice(0, 6).join("\n"),
    "steps-missing",
    5,
    "Add at least one numbered step heading."
  );
});

test("categories require level-four steps and cannot parent earlier steps", () => {
  finding(
    recipe(command, "### Beginner\n\n### 1) ✅ Check readiness"),
    "step-depth",
    9,
    "Use level 4 for every numbered step when level 3 categories are present."
  );
  finding(
    recipe(`${command}\n\n### Beginner`, "#### 1) ✅ Check readiness"),
    "step-parent",
    7,
    "Place this level 4 step below a level 3 category."
  );
  finding(
    recipe(command, "### Beginner\n\n#### Unnumbered step"),
    "category-depth",
    9,
    "Use level 3 for a category and level 4 only for its numbered steps."
  );
});

test("direct steps stay at level three", () => {
  finding(
    recipe(command, "#### 1) ✅ Check readiness"),
    "step-depth",
    7,
    "Use level 3 for direct numbered steps."
  );
});

test("step numbering continues across categories instead of restarting", () => {
  const content = recipe(
    `${command}\n\n### Advanced\n\n#### 1) 🔬 Inspect output\n\n${command}`,
    "### Beginner\n\n#### 1) ✅ Check readiness"
  );
  finding(
    content,
    "step-number",
    17,
    "Renumber this step to 2; numbering must start at 1 and remain continuous."
  );
  assert.deepEqual(inspectRecipe(file, content.replace("#### 1) 🔬", "#### 2) 🔬")).findings, []);
});

test("tables and operational images independently satisfy a step example", () => {
  for (const body of [
    "| State | Meaning |\n| --- | --- |\n| ready | Proceed |",
    "![Ready state](ready.png)",
  ]) {
    assert.deepEqual(inspectRecipe(file, recipe(body)).findings, []);
  }
  for (const body of ["Explain the readiness check.", "| State | Meaning |\nNot a table."]) {
    finding(
      recipe(body),
      "step-example",
      7,
      "Add a fenced command/config/output, a concrete table, or an operational image."
    );
  }
});

test("another step or a later section cannot supply a missing step example", () => {
  for (const body of [
    `Explain the readiness check.\n\n### 2) 🔬 Inspect output\n\n${command}`,
    `Explain the readiness check.\n\n## Verify\n\n${command}`,
  ]) {
    finding(
      recipe(body),
      "step-example",
      7,
      "Add a fenced command/config/output, a concrete table, or an operational image."
    );
  }
});

test("steps need exactly one outcome-specific section", () => {
  for (const title of ["## Steps", "## Steps to "]) {
    finding(
      recipe().replace("## Steps to check readiness", title),
      "steps-section",
      1,
      "Add exactly one outcome-specific `## Steps to ...` section."
    );
  }
  finding(
    `${recipe()}\n\n## Steps to finish\n`,
    "steps-section",
    5,
    "Add exactly one outcome-specific `## Steps to ...` section."
  );
});

test("Verify is optional, follows Steps, and occurs at most once", () => {
  const content = recipe().replace(
    "## Steps to check readiness",
    "## Verify\n\nCheck readiness.\n\n## Steps to check readiness"
  );
  finding(content, "section-order", 5, "Place `## Verify` after the steps section.");
  finding(
    `${recipe()}\n\n## Verify\n\nCheck readiness.\n\n## Verify again`,
    "verify-section",
    17,
    "Keep at most one `## Verify` section."
  );
  assert.deepEqual(inspectRecipe(file, `${recipe()}\n\n## Verification notes`).findings, []);
});

test("title count and missing-description corrections retain useful locations", () => {
  finding("", "title", 1, "Start the file with exactly one H1 title.");
  finding(`${recipe()}\n# Another title`, "title", 1, "Start the file with exactly one H1 title.");
  finding(
    "# Check readiness\n\n",
    "description",
    2,
    "Put a non-empty plain description paragraph directly after the H1."
  );
});

test("visible unfinished markers have line-specific corrections", () => {
  finding(recipe("{{command}}"), "placeholder", 9, "Replace or remove this template placeholder.");
  for (const marker of ["TODO", "TBD", "FIXME"]) {
    finding(
      recipe(`${command}\n${marker}`),
      "todo",
      12,
      "Resolve this unfinished marker before publishing the recipe."
    );
  }
  assert.deepEqual(inspectRecipe(file, recipe(`${command}\nTODOING tbd Fixme`)).findings, []);
});

test("comments hide draft content while preserving locations after multiline comments", () => {
  const content = `${recipe()}\n<!--\n# Draft\nTODO [draft](missing.md)\n-->\n{{command}}`;
  finding(content, "placeholder", 16, "Replace or remove this template placeholder.");
  assert.deepEqual(inspectRecipe(file, content).links, []);
  assert.deepEqual(
    inspectRecipe(file, content).findings.map((item) => item.rule),
    ["placeholder"]
  );
  assert.deepEqual(
    inspectRecipe(file, `${recipe()}\n<!-- TODO --> <!-- {{command}} -->`).findings,
    []
  );
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

// Raw HTML is publishable Markdown, not unfinished scaffold. CommonMark 0.31.2
// §6.6 permits attributes, uppercase names, and self-closing tags:
test.each([
  [
    "document navigation and content",
    `<html lang="en"><head data-section="metadata"><title id="title">Readiness</title>
<meta charset="utf-8"/><link rel="stylesheet" href="ready.css"/>
<style id="theme">body { color: green; }</style></head>
<body class="ready"><header id="header"><h1 id="intro">Readiness</h1></header>
<nav aria-label="sections"><a href="#ready">Ready</a></nav>
<main id="main"><article id="ready"><h2 id="overview">Overview</h2>
<section id="details"><h3 id="checks">Checks</h3><h4 id="local">Local</h4>
<h5 id="runtime">Runtime</h5><h6 id="version">Version</h6>
<p class="result"><strong class="state">Ready</strong><em class="note">Verified</em>
<span class="version">22</span><small class="units">seconds</small><i class="icon">ok</i>
<code class="command">node --version</code><br/><hr/></p>
<div class="output"><pre class="console">v22.12.0</pre></div></section></article>
<aside class="help"><details id="help"><summary class="label">Help</summary></details></aside>
<footer id="footer">End</footer></main><script type="module">console.log("ready")</script>
</body></html>`,
  ],
  [
    "interactive form and ordered checklist",
    `<form action="/check"><label for="runtime">Runtime</label><input id="runtime"/>
<select name="version"><option value="22">22</option></select>
<textarea name="notes">Installed</textarea><button type="submit">Check</button>
<ol class="steps"><li class="step">Run check</li></ol>
<ul class="results"><li class="result">Ready</li></ul></form>`,
  ],
  [
    "results table",
    `<table class="results"><thead class="labels"><tr class="header"><th scope="col">State</th></tr></thead>
<tbody class="data"><tr class="result"><td class="state">Ready</td></tr></tbody>
<tfoot class="summary"><tr class="total"><td class="count">One check</td></tr></tfoot></table>`,
  ],
  [
    "media, SVG and reusable template",
    `<picture class="screenshot"><source srcset="ready.webp"/><img src="ready.png" alt="Ready"/></picture>
<video src="ready.mp4"></video><iframe src="preview.html"></iframe>
<svg viewBox="0 0 10 10"><path d="M0 0 L10 10"/></svg>
<template id="result"><SPAN class="state">Ready</SPAN></template>`,
  ],
])("accepts concrete raw HTML for %s", (_, html) => {
  assert.deepEqual(inspectRecipe(file, recipe(`${command}\n${html}`)).findings, []);
});

test("raw HTML without attributes and self-closing markup are concrete syntax", () => {
  const content = recipe(
    `${command}\n<p>Ready<br/>Proceed<hr/></p> <custom-status>Ready</custom-status>`
  );
  assert.deepEqual(inspectRecipe(file, content).findings, []);
});

test.each([
  ["c", "#include <stddef.h>\nsize_t count = 0;"],
  ["c++", "#include <vector>\nstd::vector<int> counts;"],
  ["cpp", "#include <vector>\nstd::vector<int> counts;"],
  ["cs", "var names = new List<string>();"],
  ["csharp", "var names = new List<string>();"],
  ["go", 'markup := "<status-card/>"'],
  ["html", '<status-card state="ready"></status-card>'],
  ["java", "List<String> names = new ArrayList<String>();"],
  ["jsx", "const result = <StatusCard ready />;"],
  ["kotlin", "val names: List<String> = emptyList();"],
  ["objc", "id<NSObject> delegate = nil;"],
  ["objective-c", "id<NSObject> delegate = nil;"],
  ["rust", "let names: Vec<String> = Vec::new();"],
  ["svg", '<svg><use href="#ready"/></svg>'],
  ["swift", "let names: Array<String> = [];"],
  ["tsx", "const result = <StatusCard ready />;"],
  ["xml", '<result state="ready"/>'],
])("accepts concrete angle syntax in %s examples", (language, example) => {
  assert.deepEqual(
    inspectRecipe(file, recipe(`\`\`\`${language}\n${example}\n\`\`\``)).findings,
    []
  );
});

test("unclosed comments hide draft markers without consuming preceding visible prose", () => {
  finding(
    `${recipe()}\n{{command}} <!-- draft\nTODO <placeholder> [draft](missing.md)`,
    "placeholder",
    12,
    "Replace or remove this template placeholder."
  );
});

test("comment-looking content inside a longer tilde fence stays published code", () => {
  const body = "~~~~text\n~~~\n<!-- draft --> TODO\n~~~~";
  finding(recipe(body), "todo", 11, "Resolve this unfinished marker before publishing the recipe.");
  assert.deepEqual(
    inspectRecipe(file, recipe(body)).findings.map((item) => item.rule),
    ["todo"]
  );
});

test("inline fence-looking text leaves subsequent HTML comments hidden", () => {
  assert.deepEqual(
    inspectRecipe(
      file,
      recipe(`${command}\nA literal ~ or \`\`\` is not a fenced block.\n<!-- TODO -->`)
    ).findings,
    []
  );
});
