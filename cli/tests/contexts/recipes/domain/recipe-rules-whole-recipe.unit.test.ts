import { describe, expect, it } from "vitest";
import { inspectRecipe } from "../../../../src/contexts/recipes/domain/recipe-rules.js";
import { markdown, validDirect, withLines } from "../testing/recipe-builders.js";

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
