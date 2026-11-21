import assert from "node:assert/strict";
import { describe, expect, it, test } from "vitest";
import { inspectRecipe } from "../../../../src/contexts/recipes/domain/recipe-rules.js";
import { markdown, validDirect, withLines } from "../testing/recipe.builder.js";

describe("recipe rules", () => {
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
    finding(
      `${recipe()}\n# Another title`,
      "title",
      1,
      "Start the file with exactly one H1 title."
    );
    finding(
      "# Check readiness\n\n",
      "description",
      2,
      "Put a non-empty plain description paragraph directly after the H1."
    );
  });

  test("visible unfinished markers have line-specific corrections", () => {
    finding(
      recipe("{{command}}"),
      "placeholder",
      9,
      "Replace or remove this template placeholder."
    );
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
    finding(
      recipe(body),
      "todo",
      11,
      "Resolve this unfinished marker before publishing the recipe."
    );
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
});

describe("rule findings", () => {
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
    assert.deepEqual(
      inspectRecipe(file, `${content}\n\n## Further Steps to consider`).findings,
      []
    );
  });

  test("step headings allow spacing between the number, emoji and title", () => {
    assert.deepEqual(
      inspectRecipe(file, document(`### 1)   ✅   Publish\n${example}`)).findings,
      []
    );
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
});

describe("whole recipes", () => {
  const FILE = "recipe.md";

  function rules(lines: readonly string[]): string[] {
    return inspectRecipe(FILE, markdown(lines)).findings.map((f) => `${f.line}:${f.rule}`);
  }

  const valid = validDirect();

  describe("a whole recipe is accepted", () => {
    it.each([
      [
        "a description with an abbreviation",
        withLines({ 2: "Filter noisy output with a CLI, e.g. RTK." }),
      ],
      [
        "a description of two sentences",
        withLines({ 2: "Produce one result. Then produce another." }),
      ],
      ["a description without a full stop", withLines({ 2: "Filter noisy output with a CLI" })],
      [
        "introductory context",
        [
          ...valid.slice(0, 3),
          "",
          "Run this check after installing the prerequisites.",
          ...valid.slice(3),
        ],
      ],
      [
        "an optional Why section",
        [
          ...valid.slice(0, 4),
          "## Why",
          "",
          "Check prerequisites before a full build.",
          "",
          ...valid.slice(4),
        ],
      ],
      [
        "step prose of two sentences",
        withLines({ 8: "This command is fast. It returns the observable result." }),
      ],
      [
        "JSX tags as an example",
        withLines({ 10: "```jsx", 11: "const view = <Button>Save</Button>;" }),
      ],
      ["a C include as an example", withLines({ 10: "```c", 11: "#include <stdio.h>" })],
      [
        "generic types as an example",
        withLines({ 10: "```java", 11: "List<String> names = new ArrayList<String>();" }),
      ],
      [
        "a table of contents without Verify",
        [
          ...valid.slice(0, 3),
          "",
          "- [Steps](#steps-to-produce-the-result)",
          ...valid.slice(3, valid.indexOf("## Verify")),
        ],
      ],
      ["a link hidden in an HTML comment", [...valid, "", "<!-- [draft](missing.md) -->"]],
    ])("%s", (_name, lines) => {
      expect(rules(lines)).toEqual([]);
    });

    it("collects no local link from an HTML comment", () => {
      const content = markdown([...valid, "", "<!-- [draft](missing.md) -->"]);
      expect(inspectRecipe(FILE, content).links).toEqual([]);
    });
  });

  describe("a whole recipe is rejected", () => {
    it.each([
      [
        "an HTML comment inside a JSON example",
        withLines({ 10: "```json", 11: '{"enabled": true <!-- remove me -->}' }),
        ["11:json-syntax"],
      ],
      [
        "scaffold prose in the step and the example",
        withLines({
          8: "<One benefit-focused line of what and why, in prose.>",
          11: "<a config or snippet the reader can copy>",
        }),
        ["9:placeholder", "12:placeholder"],
      ],
    ])("%s", (_name, lines, expected) => {
      expect(rules(lines)).toEqual(expect.arrayContaining(expected));
    });

    it("reports a missing example, an open fence, a placeholder, invalid JSON and a marker together", () => {
      const lines = [
        "# Broken examples",
        "",
        "Produce a result.",
        "",
        "## Steps to produce a result",
        "",
        "### 1) ✅ Explain only",
        "",
        "This step still contains <placeholder>.",
        "",
        "### 2) 🔧 Parse JSON",
        "",
        "This malformed example must fail.",
        "",
        "```json",
        '{"broken": }',
        "```",
        "",
        "### 3) 🧪 Close the fence",
        "",
        "This example has no closing marker.",
        "",
        "```text",
        "TODO",
      ];
      expect(rules(lines).map((entry) => entry.split(":")[1])).toEqual(
        expect.arrayContaining([
          "step-example",
          "fence-balance",
          "placeholder",
          "json-syntax",
          "todo",
        ])
      );
    });

    it.each([
      "",
      "## Description",
      "- Filter output.",
      "* Filter output.",
      "+ Filter output.",
      "1. Filter output.",
      "1) Filter output.",
      "> Filter output.",
      "| Goal | Filter output. |",
      "---",
      "```text",
      "~~~text",
      "![Output](https://example.com/output.png)",
    ])("a description line of %j", (description) => {
      expect(rules(withLines({ 2: description })).map((entry) => entry.split(":")[1])).toContain(
        "description"
      );
    });
  });
});
