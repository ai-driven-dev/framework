import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ValidateRecipes } from "../../../../src/contexts/recipes/application/validate-recipes.js";
import { RecipeFilesAdapter } from "../../../../src/contexts/recipes/infrastructure/recipe-files-adapter.js";
import { REPOSITORY_ROOT } from "../../../helpers/repository-root.js";
import { markdown, withLines } from "../testing/recipe-builders.js";

const templatePath = path.join(
  REPOSITORY_ROOT,
  "plugins/aidd-context/skills/12-cook/assets/recipe-template.md"
);
const template = fs.readFileSync(templatePath, "utf8");

function findingsOf(lines: readonly string[]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-recipe-assets-"));
  const file = path.join(directory, "recipe.md");
  try {
    fs.writeFileSync(file, markdown(lines), "utf8");
    return new ValidateRecipes(new RecipeFilesAdapter()).execute({ files: [file], directories: [] })
      .findings;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function filledTemplate() {
  let filled = template
    .split("\n")
    .filter((line) => !line.startsWith("> Fill "))
    .join("\n");
  const replacements = new Map([
    ["<Recipe title>", "Check a Node.js installation"],
    [
      "<One sentence describing what this recipe gets the reader.>",
      "Check the installed Node.js runtime and configuration.",
    ],
    [
      "<Short and benefit-first, one idea per line. Lead with the keywords a reader would search, **bold** the key terms.>",
      "**Runtime checks** reveal whether this environment can run the project.",
    ],
    ["<the outcome the reader achieves>", "check the runtime"],
    ["<emoji>", "✅"],
    ["<First step title>", "Check the version"],
    [
      "<One benefit-focused line of what and why, in prose.>",
      "Check the version before running project commands.",
    ],
    [
      "<where it is, then install it from its URL>",
      "Install Node.js from https://nodejs.org/en/download.",
    ],
    ["<how to invoke it — its real command or slash>", "Run `node --version`."],
    ["<command the reader runs>", "node --version"],
    ["<the useful output it prints, trimmed to what matters>", "v22.12.0"],
    ["<Next step title>", "Check the configuration"],
    [
      "<Benefit-focused what and why, in prose.>",
      "Check the configuration before enabling the feature.",
    ],
    ["<action>", "Read the configuration."],
    ["<lang>", "json"],
    ["<a config or snippet the reader can copy>", '{"enabled": true}'],
    ["<Last step title — until the goal is reached>", "Identify the runtime"],
    ["<what this screenshot or video shows>", "Node.js logo"],
    ["<path-or-url>", "https://nodejs.org/static/logos/nodejsDark.svg"],
    [
      "<Optional. An observable check that proves it worked: a command, a UI state, a file that now exists.>",
      "Confirm `node --version` prints the installed version.",
    ],
  ]);
  for (const [placeholder, value] of replacements) filled = filled.replaceAll(placeholder, value);
  return filled.split("\n");
}

describe("the recipe template the cook skill ships", () => {
  it("is visible Markdown: a title, the sections and the example kinds, with no hidden comment", () => {
    expect(template).toMatch(/^# <Recipe title>\r?\n/u);
    expect(template).not.toContain("<!--");
    for (const part of [
      "## Why",
      "### 🟢 Beginner",
      "### 🟡 Intermediate",
      "### 🔴 Expert",
      "## Verify",
      "```bash",
      "```<lang>",
      "![<what this screenshot or video shows>](<path-or-url>)",
    ]) {
      expect(template, part).toContain(part);
    }
  });

  it("passes once every placeholder is filled in", () => {
    expect(findingsOf(filledTemplate())).toEqual([]);
  });

  it("is rejected for each multiword placeholder left in an angle-syntax example", () => {
    const placeholders = [...template.matchAll(/<([^<>\n]*\s[^<>\n]*)>/gu)].map(
      (match) => match[0]
    );
    expect(placeholders.length).toBeGreaterThanOrEqual(10);
    for (const language of ["jsx", "tsx", "c", "cpp", "java", "rust", "html", "xml"]) {
      for (const placeholder of placeholders) {
        const rules = findingsOf(withLines({ 10: `\`\`\`${language}`, 11: placeholder })).map(
          (f) => f.rule
        );
        expect(rules, `${language}: ${placeholder}`).toContain("placeholder");
      }
    }
  });
});
