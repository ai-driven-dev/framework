import assert from "node:assert/strict";
import { test } from "vitest";
import type { RecipeFinding } from "../../../../src/contexts/recipes/domain/markdown-scan.js";
import { reporter, scanRecipe } from "../../../../src/contexts/recipes/domain/markdown-scan.js";
import { checkSteps } from "../../../../src/contexts/recipes/domain/recipe-steps.js";

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

/** What the steps section alone reports, found the way a recipe's own sections are. */
function stepFindings(content: string): RecipeFinding[] {
  const findings: RecipeFinding[] = [];
  const report = reporter(findings, file);
  const scanned = scanRecipe(content, report);
  const section = scanned.headings.find(
    (heading) => heading.depth === 2 && /^Steps to\s+\S/u.test(heading.text)
  );
  if (section) checkSteps(scanned, section, report);
  return findings;
}

function finding(content: string, rule: string, line: number, fix: string) {
  assert.deepEqual(
    stepFindings(content).filter((item) => item.rule === rule),
    [{ file, line, rule, fix }]
  );
}

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
    "Use level 4 for numbered category steps or subsections of a direct numbered step."
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

test("direct numbered steps allow unnumbered level-four subsections", () => {
  const content = recipe(
    `#### Version control\n\n${command}\n\n#### Database\n\n${command}\n\n### 2) 🔌 Connect\n\n#### Authentication\n\n${command}`
  );
  assert.deepEqual(stepFindings(content), []);
});

test("unnumbered level-four subsections require a direct numbered parent", () => {
  for (const heading of [
    "#### Orphan subsection",
    "### 1. ✅ Check readiness\n\n#### Subsection",
    "### 1) ✅ Check readiness\n\n### Beginner\n\n#### Subsection",
    "### Beginner\n\n#### 1) ✅ Check readiness\n\n#### Subsection",
  ]) {
    assert.equal(
      stepFindings(recipe(command, heading)).some((item) => item.rule === "category-depth"),
      true
    );
  }
});

test.each(["#### 2. 🔌 Connect", "#### 2 🔌 Connect"])(
  "subsections do not hide malformed numbered step heading %s",
  (heading) => {
    finding(
      recipe(`${heading}\n\n${command}`),
      "step-heading",
      9,
      "Use `### N) <emoji> Title`, or `#### N) <emoji> Title` below a category."
    );
  }
);

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
  assert.deepEqual(stepFindings(content.replace("#### 1) 🔬", "#### 2) 🔬")), []);
});

test("tables and operational images independently satisfy a step example", () => {
  for (const body of [
    "| State | Meaning |\n| --- | --- |\n| ready | Proceed |",
    "![Ready state](ready.png)",
  ]) {
    assert.deepEqual(stepFindings(recipe(body)), []);
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
