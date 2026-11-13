import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ValidateRecipes } from "../../../../src/contexts/recipes/application/validate-recipes.js";
import { InputRequiredError } from "../../../../src/kernel/errors.js";
import { InMemoryRecipeFiles } from "../testing/in-memory-recipe-files.js";
import { categorized, markdown, validDirect, withLines } from "../testing/recipe-builders.js";

const at = (name: string): string => path.resolve("/recipes", name);
const recipe = at("recipe.md");
const valid = validDirect();
const absent = "This step links to [x](missing.md).";

function filesOf(entries: Record<string, string>): InMemoryRecipeFiles {
  const files = new InMemoryRecipeFiles();
  for (const [name, content] of Object.entries(entries)) files.addFile(at(name), content);
  return files;
}

function findings(entries: Record<string, string>, target = recipe) {
  return new ValidateRecipes(filesOf(entries)).execute({ files: [target], directories: [] })
    .findings;
}

const brief = (found: { line: number; rule: string }[]): string[] =>
  found.map(({ line, rule }) => `${line}:${rule}`);

describe("a recipe is accepted", () => {
  it("whether direct or sorted in categories, and reports the count", () => {
    const files = filesOf({ "recipe.md": markdown(valid), "other.md": markdown(categorized()) });
    const result = new ValidateRecipes(files).execute({
      files: [recipe, at("other.md")],
      directories: [],
    });
    expect(result).toEqual({ findings: [], fileCount: 2 });
  });

  it("when its extension is in capitals", () => {
    expect(findings({ "recipe.MD": markdown(valid) }, at("recipe.MD"))).toEqual([]);
  });
});

describe("a recipe that cannot be validated is a finding", () => {
  it.each([
    ["a missing file", "file-exists"],
    ["a directory", "file-type"],
  ])("%s", (_name, rule) => {
    const files = new InMemoryRecipeFiles().addDirectory(at("folder"));
    const target = rule === "file-type" ? at("folder") : at("missing.md");
    const result = new ValidateRecipes(files).execute({ files: [target], directories: [] });
    expect(result.findings).toEqual([
      { file: target, line: 1, rule, fix: expect.stringContaining("Pass a readable Markdown") },
    ]);
  });

  it("a file that cannot be read, naming the code", () => {
    const files = filesOf({ "recipe.md": markdown(valid) }).deny(recipe, "EACCES");
    const result = new ValidateRecipes(files).execute({ files: [recipe], directories: [] });
    expect(result.findings).toEqual([
      {
        file: recipe,
        line: 1,
        rule: "file-read",
        fix: "Pass a readable Markdown recipe file (EACCES).",
      },
    ]);
  });

  it("a readable file that is not Markdown", () => {
    const target = at("recipe.txt");
    expect(findings({ "recipe.txt": markdown(valid) }, target)).toEqual([
      {
        file: target,
        line: 1,
        rule: "file-type",
        fix: "Pass a Markdown recipe file ending in .md.",
      },
    ]);
  });

  it("nothing at all to validate", () => {
    const run = () => new ValidateRecipes(filesOf({})).execute({ files: [], directories: [] });
    expect(run).toThrow(InputRequiredError);
    expect(run).toThrow(/Pass at least one recipe path/u);
  });
});

describe("the recipes to validate", () => {
  it("are explicit paths plus each directory, once each, ordered, and every finding is ordered by file, line and rule", () => {
    const earlier = withLines({ 6: "### 2) plain Run the check" });
    earlier.push("", "[Absent](#missing)");
    const files = filesOf({
      "a.md": markdown(earlier),
      "z.md": "",
      "README.md": "Not a recipe",
      "notes.txt": "Not a recipe",
    });
    const result = new ValidateRecipes(files).execute({
      files: [at("z.md"), at("a.md"), at("z.md")],
      directories: [{ path: at("."), optional: false }],
    });
    expect(result.fileCount).toBe(2);
    expect(
      result.findings.map(({ file, line, rule }) => [path.basename(file), line, rule])
    ).toEqual([
      ["a.md", 7, "step-emoji"],
      ["a.md", 7, "step-number"],
      ["a.md", 19, "link-anchor"],
      ["z.md", 1, "steps-section"],
      ["z.md", 1, "title"],
    ]);
  });

  it("tolerate a missing optional directory beside a required one that exists", () => {
    const files = filesOf({ "recipe.md": markdown(valid) });
    const result = new ValidateRecipes(files).execute({
      files: [],
      directories: [
        { path: at("absent"), optional: true },
        { path: at("."), optional: false },
      ],
    });
    expect(result).toEqual({ findings: [], fileCount: 1 });
  });

  it("refuse a missing required directory", () => {
    const run = () =>
      new ValidateRecipes(filesOf({})).execute({
        files: [],
        directories: [{ path: at("absent"), optional: false }],
      });
    expect(run).toThrow(expect.objectContaining({ code: "ENOENT" }));
  });
});

describe("local links", () => {
  const withLink = (...links: string[]) => markdown([...valid, "", ...links]);

  it.each([
    [
      "a heading read by its visible text",
      withLink("[Reference](reference.md#details)"),
      { "reference.md": "# [Details](https://example.com)\n" },
    ],
    [
      "a heading with inline HTML, through an encoded path",
      withLink("[Reference](reference%20notes.md#details--examples)"),
      { "reference notes.md": "# <em>Details</em> & Examples\n" },
    ],
    [
      "inline text, nested tags and an unterminated tag in headings",
      withLink(
        "[Inline](reference.md#foobar)",
        "[Nested](reference.md#startfinish)",
        "[Unterminated](reference.md#safe)"
      ),
      {
        "reference.md":
          "# foo<strong>bar</strong>\n## start<outer <inner>hidden>finish\n## safe<script\n",
      },
    ],
    [
      "titled, angle-wrapped and encoded targets with repeated headings, an image and a data file",
      withLink(
        '[First](reference%20notes.MD#d%C3%A9tails "Details")',
        "[Second](<reference notes.MD#détails-1> 'Repeated heading')",
        "[Same recipe](#1--run-the-check)",
        "![Screenshot](image.png)",
        "[Data](data.txt)"
      ),
      {
        "reference notes.MD": "# Détails\n## Détails\n",
        "image.png": "ÿ\u0000",
        "data.txt": "data",
      },
    ],
  ])("resolve %s", (_name, content, others) => {
    expect(findings({ "recipe.md": content, ...others })).toEqual([]);
  });

  it("ignore external and empty targets, and links inside a code fence", () => {
    const lines = withLines({ 11: "[Example](missing.md)" });
    lines.push(
      "",
      ...[
        "https://example.com",
        "HTTP://example.com",
        "mailto:a@example.com",
        "tel:123",
        "codex:open",
        " ",
      ].map((target) => `[Link](${target})`)
    );
    expect(findings({ "recipe.md": markdown(lines) })).toEqual([]);
  });

  it("report a missing file and a missing heading, each at its line", () => {
    const content = markdown(withLines({ 8: absent }));
    expect(brief(findings({ "recipe.md": `${content}\n[no heading](#absent)\n` }))).toEqual([
      "9:link-target",
      "19:link-anchor",
    ]);
  });

  it("report a heading the other file lacks, with the correction", () => {
    expect(
      findings({
        "recipe.md": withLink("[Absent](reference.md#missing)"),
        "reference.md": "# Present\n",
      })
    ).toEqual([
      {
        file: recipe,
        line: 19,
        rule: "link-anchor",
        fix: "Point the link to an existing heading: #missing",
      },
    ]);
  });

  it("report a malformed encoding, a missing image and an anchor on a file that is not Markdown", () => {
    const content = withLink(
      "[Malformed](bad%ZZ.md)",
      "![Screenshot](missing.png)",
      "[Data](data.txt#details)"
    );
    expect(findings({ "recipe.md": content, "data.txt": "data" })).toEqual([
      {
        file: recipe,
        line: 19,
        rule: "link-encoding",
        fix: "Encode the link target correctly: bad%ZZ.md",
      },
      {
        file: recipe,
        line: 20,
        rule: "image-target",
        fix: "Point the local target to a readable file: missing.png (ENOENT).",
      },
      {
        file: recipe,
        line: 21,
        rule: "link-anchor",
        fix: "Remove the anchor or target a Markdown heading: #details",
      },
    ]);
  });

  it("report a target that is a directory, or that cannot be read, as a link target", () => {
    const files = filesOf({
      "recipe.md": withLink("[Dir](directory.md#details)", "[Denied](denied.md#details)"),
      "denied.md": "# Details\n",
    })
      .addDirectory(at("directory.md"))
      .deny(at("denied.md"), "EACCES");
    const result = new ValidateRecipes(files).execute({ files: [recipe], directories: [] });
    expect(result.findings.map(({ line, rule, fix }) => [line, rule, fix])).toEqual([
      [19, "link-target", "Point the local target to a readable file: directory.md (EISDIR)."],
      [20, "link-target", "Point the local target to a readable file: denied.md (EACCES)."],
    ]);
  });

  it("keep a placeholder in an example, and exempt only the destination of a link", () => {
    const cases: [string, string, number][] = [
      ["[Notes](<reference notes.md>)", "<placeholder>", 20],
      ["[<placeholder>](<reference notes.md>)", "", 19],
      ['[Notes](<reference notes.md> "<placeholder>")', "", 19],
    ];
    for (const [link, extra, line] of cases) {
      const lines = withLines({ 8: "Keep <before-placeholder> visible." });
      lines.push("", link, extra);
      const found = findings({ "recipe.md": markdown(lines), "reference notes.md": "# Notes\n" });
      expect(brief(found)).toEqual(["9:placeholder", `${line}:placeholder`]);
    }
    const missing = withLines({ 11: "[Example](<placeholder>)" });
    missing.push("", "[Missing](<missing notes.md>)");
    expect(brief(findings({ "recipe.md": markdown(missing) }))).toEqual([
      "12:placeholder",
      "19:link-target",
    ]);
  });

  it("read a link target's content only when it is Markdown", () => {
    const files = filesOf({
      "recipe.md": withLink("![Screenshot](image.png)", "[Notes](notes.md)"),
      "image.png": "ÿ",
      "notes.md": "# Notes\n",
    });
    const read = vi.spyOn(files, "read");
    new ValidateRecipes(files).execute({ files: [recipe], directories: [] });
    expect(read).toHaveBeenCalledWith(at("image.png"), false);
    expect(read).toHaveBeenCalledWith(at("notes.md"), true);
  });

  it("read a target once however many links point at it", () => {
    const files = filesOf({
      "recipe.md": withLink("[A](notes.md)", "[B](notes.md#notes)"),
      "notes.md": "# Notes\n",
    });
    const read = vi.spyOn(files, "read");
    new ValidateRecipes(files).execute({ files: [recipe], directories: [] });
    expect(read.mock.calls.filter(([file]) => file === at("notes.md"))).toHaveLength(1);
  });
});
