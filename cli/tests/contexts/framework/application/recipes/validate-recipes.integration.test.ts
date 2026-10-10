import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, vi } from "vitest";
import { ValidateRecipesUseCase } from "../../../../../src/contexts/framework/application/recipes/validate-recipes-use-case.js";
import { RecipeFilesAdapter } from "../../../../../src/contexts/framework/infrastructure/recipe-files-adapter.js";
import { renderRecipeValidation } from "../../../../../src/presentation/display/framework-display.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";

const root = REPOSITORY_ROOT;
const bundled = path.join(root, "plugins/aidd-context/skills/12-cook/assets/recipes");

function validateRecipe(file: string) {
  return new ValidateRecipesUseCase(new RecipeFilesAdapter()).execute({
    files: [file],
    directories: [],
  }).findings;
}

function run(args: string[], cwd = root) {
  const all = args.includes("--all");
  const result = new ValidateRecipesUseCase(new RecipeFilesAdapter()).execute({
    files: args.filter((arg) => arg !== "--all").map((file) => path.resolve(cwd, file)),
    directories: all
      ? [
          { path: path.join(cwd, "aidd_docs", "recipes"), optional: true },
          { path: bundled, optional: false },
        ]
      : [],
  });
  const rendered = `${renderRecipeValidation(result, cwd)}\n`;
  return {
    status: result.findings.length ? 1 : 0,
    stdout: result.findings.length ? "" : rendered,
    stderr: result.findings.length ? rendered : "",
  };
}

function fixture(lines: string[]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-recipe-validator-"));
  const file = path.join(directory, "recipe.md");
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  return { directory, file };
}

function validDirect(title = "Valid recipe") {
  return [
    `# ${title}`,
    "",
    "Produce one observable result.",
    "",
    "## Steps to produce the result",
    "",
    "### 1) ✅ Run the check",
    "",
    "This command returns the observable result.",
    "",
    "```bash",
    "echo ok",
    "```",
    "",
    "## Verify",
    "",
    "- Confirm the command prints `ok`.",
  ];
}

test("rejects HTML comments inside published JSON examples", () => {
  const lines = validDirect();
  lines[10] = "```json";
  lines[11] = '{"enabled": true <!-- remove me -->}';
  const item = fixture(lines);
  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /json-syntax/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("ignores local links in HTML comments", () => {
  const lines = validDirect();
  lines.push("", "<!-- [draft](missing.md) -->");
  const item = fixture(lines);
  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("resolves linked headings by their visible text", () => {
  const lines = validDirect();
  lines.push("", "[Reference](reference.md#details)");
  const item = fixture(lines);
  fs.writeFileSync(
    path.join(item.directory, "reference.md"),
    "# [Details](https://example.com)\n",
    "utf8"
  );
  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("rejects instructional scaffold prose in JSX examples", () => {
  const lines = validDirect();
  lines[10] = "```jsx";
  lines[11] = "<a config or snippet the reader can copy>";
  const item = fixture(lines);
  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /placeholder/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("rejects every multiword template placeholder in angle-syntax examples", () => {
  const template = fs.readFileSync(
    path.join(root, "plugins/aidd-context/skills/12-cook/assets/recipe-template.md"),
    "utf8"
  );
  const placeholders = [...template.matchAll(/<([^<>\n]*\s[^<>\n]*)>/gu)].map((match) => match[0]);
  assert.ok(placeholders.length >= 10);
  for (const language of ["jsx", "tsx", "c", "cpp", "java", "rust", "html", "xml"]) {
    for (const placeholder of placeholders) {
      const lines = validDirect();
      lines[10] = `\`\`\`${language}`;
      lines[11] = placeholder;
      const item = fixture(lines);
      try {
        const result = run([item.file]);
        assert.equal(result.status, 1, `${language}: ${placeholder}`);
        assert.match(result.stderr, /placeholder/u);
      } finally {
        fs.rmSync(item.directory, { recursive: true, force: true });
      }
    }
  }
});

test("accepts concrete generic type syntax", () => {
  const lines = validDirect();
  lines[10] = "```java";
  lines[11] = "List<String> names = new ArrayList<String>();";
  const item = fixture(lines);
  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

function filledTemplate() {
  let template = fs.readFileSync(
    path.join(root, "plugins/aidd-context/skills/12-cook/assets/recipe-template.md"),
    "utf8"
  );
  template = template
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
  for (const [placeholder, value] of replacements)
    template = template.replaceAll(placeholder, value);
  return template.split("\n");
}

test("validates the filled Markdown template with Why, all categories, and command/config/image examples", () => {
  const item = fixture(filledTemplate());
  try {
    const before = fs.readFileSync(item.file, "utf8");
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(item.file, "utf8"), before);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("validates direct and categorized recipes", () => {
  const direct = fixture(validDirect());
  const categorized = fixture([
    "# Categorized recipe",
    "",
    "Produce two observable results.",
    "",
    "## Steps to produce the results",
    "",
    "### 🟢 Beginner",
    "",
    "#### 1) ✅ Run the first check",
    "",
    "This command confirms the prerequisite.",
    "",
    "```bash",
    "echo first",
    "```",
    "",
    "### 🔴 Expert",
    "",
    "#### 2) 🔬 Run the second check",
    "",
    "This command confirms the advanced result.",
    "",
    "```bash",
    "echo second",
    "```",
  ]);

  try {
    const directBefore = fs.readFileSync(direct.file, "utf8");
    const categorizedBefore = fs.readFileSync(categorized.file, "utf8");
    const result = run([direct.file, categorized.file]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "PASS: 2 recipe(s) validated.\n");
    assert.equal(fs.readFileSync(direct.file, "utf8"), directBefore);
    assert.equal(fs.readFileSync(categorized.file, "utf8"), categorizedBefore);
  } finally {
    fs.rmSync(direct.directory, { recursive: true, force: true });
    fs.rmSync(categorized.directory, { recursive: true, force: true });
  }
});

test("reports invalid title and non-continuous steps with line numbers", () => {
  const item = fixture([
    "Intro before title.",
    "# Broken recipe",
    "",
    "Produce a result.",
    "",
    "## Steps to produce a result",
    "",
    "### 2) ✅ Run the check",
    "",
    "This command produces a result.",
    "",
    "```bash",
    "echo ok",
    "```",
  ]);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\| .*recipe\.md \| 2 \| title \|/u);
    assert.match(result.stderr, /\| .*recipe\.md \| 8 \| step-number \|/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports missing examples, broken fences, placeholders, and invalid JSON", () => {
  const item = fixture([
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
  ]);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /step-example/u);
    assert.match(result.stderr, /fence-balance/u);
    assert.match(result.stderr, /placeholder/u);
    assert.match(result.stderr, /json-syntax/u);
    assert.match(result.stderr, /todo/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("accepts plain descriptions without guessing sentence boundaries", () => {
  for (const description of [
    "Filter noisy output with a CLI, e.g. RTK.",
    "Produce one result. Then produce another.",
    "Filter noisy output with a CLI",
  ]) {
    const lines = validDirect();
    lines[2] = description;
    const item = fixture(lines);
    try {
      const result = run([item.file]);
      assert.equal(result.status, 0, result.stderr);
    } finally {
      fs.rmSync(item.directory, { recursive: true, force: true });
    }
  }
});

test("requires a non-empty plain description before the sections", () => {
  for (const description of [
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
  ]) {
    const lines = validDirect();
    lines[2] = description;
    const item = fixture(lines);
    try {
      const result = run([item.file]);
      assert.equal(result.status, 1, description);
      assert.match(result.stderr, /\| description \|/u, description);
    } finally {
      fs.rmSync(item.directory, { recursive: true, force: true });
    }
  }
});

test("accepts useful introductory context", () => {
  const lines = validDirect();
  lines.splice(3, 0, "", "Run this check after installing the project prerequisites.");
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("accepts an optional useful Why section", () => {
  const lines = validDirect();
  lines.splice(4, 0, "## Why", "", "Check prerequisites before spending time on a full build.", "");
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("accepts useful prose with more than one sentence", () => {
  const lines = validDirect();
  lines[8] = "This command is fast. It returns the observable result.";
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("accepts JSX tags as concrete examples", () => {
  const lines = validDirect();
  lines[10] = "```jsx";
  lines[11] = "const view = <Button>Save</Button>;";
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("accepts C include directives as concrete examples", () => {
  const lines = validDirect();
  lines[10] = "```c";
  lines[11] = "#include <stdio.h>";
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports broken local targets and heading anchors", () => {
  const item = fixture([
    "# Broken links",
    "",
    "Produce a result.",
    "",
    "## Steps to produce a result",
    "",
    "### 1) ✅ Open the reference",
    "",
    "This step links to [nothing](missing.md) and [no heading](#absent).",
    "",
    "```text",
    "open reference",
    "```",
  ]);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /link-target/u);
    assert.match(result.stderr, /link-anchor/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("accepts an optional table of contents on a short recipe without Verify", () => {
  const lines = validDirect();
  lines.splice(
    3,
    0,
    "",
    "- [Steps](#steps-to-produce-the-result)",
    "- [Run the check](#1--run-the-check)"
  );
  lines.splice(lines.indexOf("## Verify"));
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("rejects duplicate verification", () => {
  const lines = validDirect();
  lines.push("", "## Verify again", "", "- Confirm it twice.");
  const item = fixture(lines);

  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /verify-section/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("--all includes project recipes and bundled recipes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-recipe-all-"));
  const projectRecipes = path.join(directory, "aidd_docs", "recipes");
  fs.mkdirSync(projectRecipes, { recursive: true });
  fs.writeFileSync(
    path.join(projectRecipes, "project.md"),
    `${validDirect("Project recipe").join("\n")}\n`,
    "utf8"
  );

  try {
    const result = run(["--all"], directory);
    assert.equal(result.status, 0, result.stderr);
    const match = result.stdout.match(/PASS: (\d+) recipe\(s\) validated\./u);
    assert.ok(match, result.stdout);
    assert.equal(Number.parseInt(match[1], 10), 4, result.stdout);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("requires paths or a non-empty recipe directory", () => {
  assert.throws(() => run([]), /Pass at least one recipe path/u);
});

test("renders the recipe template as visible Markdown", () => {
  const template = fs.readFileSync(
    path.join(root, "plugins/aidd-context/skills/12-cook/assets/recipe-template.md"),
    "utf8"
  );
  for (const content of [template, template.replace(/\r?\n/gu, "\r\n")]) {
    assert.match(content, /^# <Recipe title>\r?\n/u);
  }
  assert.ok(!template.includes("<!--"));
  for (const section of [
    "## Why",
    "### 🟢 Beginner",
    "### 🟡 Intermediate",
    "### 🔴 Expert",
    "## Verify",
  ]) {
    assert.ok(template.includes(section), section);
  }
  assert.ok(template.includes("```bash"));
  assert.ok(template.includes("```<lang>"));
  assert.ok(template.includes("![<what this screenshot or video shows>](<path-or-url>)"));
});

test("reports skipped heading levels and discontinuous numbering across categories", () => {
  const lines = validDirect();
  lines[6] = "#### 2) ✅ Run the check";
  const item = fixture(lines);
  try {
    const before = fs.readFileSync(item.file, "utf8");
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /heading-depth/u);
    assert.match(result.stderr, /step-number/u);
    assert.equal(fs.readFileSync(item.file, "utf8"), before);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports visible scaffold placeholders, including capitals and punctuation", () => {
  const lines = validDirect();
  lines[8] = "<One benefit-focused line of what and why, in prose.>";
  lines[11] = "<a config or snippet the reader can copy>";
  const item = fixture(lines);
  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\| .*recipe\.md \| 9 \| placeholder \|/u);
    assert.match(result.stderr, /\| .*recipe\.md \| 12 \| placeholder \|/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("resolves heading anchors with inline HTML and encoded local paths", () => {
  const lines = validDirect();
  lines.push("", "[Reference](reference%20notes.md#details--examples)");
  const item = fixture(lines);
  fs.writeFileSync(
    path.join(item.directory, "reference notes.md"),
    "# <em>Details</em> & Examples\n",
    "utf8"
  );
  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("resolves inline text and ignores nested or unterminated tags in heading anchors", () => {
  const lines = validDirect();
  lines.push(
    "",
    "[Inline](reference.md#foobar)",
    "[Nested](reference.md#startfinish)",
    "[Unterminated](reference.md#safe)"
  );
  const item = fixture(lines);
  fs.writeFileSync(
    path.join(item.directory, "reference.md"),
    "# foo<strong>bar</strong>\n## start<outer <inner>hidden>finish\n## safe<script\n",
    "utf8"
  );
  try {
    const result = run([item.file]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports missing recipe paths and directories as structured findings", () => {
  const item = fixture(validDirect());
  try {
    for (const [target, rule] of [
      [path.join(item.directory, "missing.md"), "file-exists"],
      [item.directory, "file-type"],
    ]) {
      const result = run([target]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\| File \| Line \| Rule \| Fix \|/u);
      assert.ok(result.stderr.includes(`| ${rule} |`), result.stderr);
      assert.doesNotMatch(result.stderr, /at validateRecipe/u);
    }
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports directory Markdown link targets without throwing", () => {
  const lines = validDirect();
  lines.push("", "[Reference](directory.md#details)");
  const item = fixture(lines);
  fs.mkdirSync(path.join(item.directory, "directory.md"));
  try {
    const result = run([item.file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\| .*recipe\.md \| 19 \| link-target \|/u);
    assert.doesNotMatch(result.stderr, /at checkLinks/u);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports read failures as findings and closes the recipe descriptor", () => {
  const item = fixture(validDirect());
  const close = fs.closeSync;
  const closed: number[] = [];
  try {
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
    });
    vi.spyOn(fs, "closeSync").mockImplementation((fd) => {
      closed.push(fd);
      return close(fd);
    });
    const findings = validateRecipe(item.file);
    assert.ok(
      findings.some((finding) => finding.rule === "file-read"),
      JSON.stringify(findings)
    );
    assert.equal(closed.length, 1);
  } finally {
    vi.restoreAllMocks();
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("reports unreadable referenced Markdown and closes its descriptor", () => {
  const lines = validDirect();
  lines.push("", "[Reference](reference.md#details)");
  const item = fixture(lines);
  const reference = path.join(item.directory, "reference.md");
  fs.writeFileSync(reference, "# Details\n", "utf8");
  const open = fs.openSync;
  const read = fs.readFileSync;
  const close = fs.closeSync;
  const descriptors = new Set<number>();
  const closed: number[] = [];
  try {
    vi.spyOn(fs, "openSync").mockImplementation((target, ...args) => {
      const fd = open(target, ...args);
      if (target === reference) descriptors.add(fd);
      return fd;
    });
    vi.spyOn(fs, "readFileSync").mockImplementation((target, ...args) => {
      if (target === reference || (typeof target === "number" && descriptors.has(target)))
        throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
      return read(target, ...args);
    });
    vi.spyOn(fs, "closeSync").mockImplementation((fd) => {
      closed.push(fd);
      return close(fd);
    });
    const findings = validateRecipe(item.file);
    assert.ok(
      findings.some((finding) => finding.rule === "link-target" && finding.line === 19),
      JSON.stringify(findings)
    );
    assert.equal(descriptors.size, 1);
    for (const fd of descriptors) assert.ok(closed.includes(fd));
  } finally {
    vi.restoreAllMocks();
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});
