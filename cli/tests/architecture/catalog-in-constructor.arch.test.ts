/**
 * The tool catalog is a collaborator of the class that asks it, so it arrives at construction. A
 * method taking it, or an options type carrying it, makes every caller thread the catalog through
 * and lets two calls of one object disagree on it. A free function may take it: it is no command.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./helpers.js";
import { blankComments } from "./source-shapes.js";

const IN_SCOPE = /^src\/(?:contexts\/[^/]+\/application|orchestration)\//;

/** The one file that is the catalog: it implements the type, it is not handed one. */
const IS_THE_CATALOG = "src/contexts/tools/application/registered-tool-catalog.ts";

const IMPORTS = /^\s*import\b[^;]*;/gm;
const PICK = /\bPick\s*<\s*ToolCatalog\b/g;
const NAME = /\bToolCatalog\b/g;

/** What may open the parenthesis of a parameter list that holds the catalog. */
const ALLOWED_LIST_OPENER = /(?:\bconstructor|\bfunction\s*\*?\s*\w*|=>?|\basync)\s*$/;

/** The code with comments and imports blanked in place, so a line is the file's own. */
function bareCode(source: string): string {
  return blankComments(source).replace(IMPORTS, (match) => match.replace(/[^\n]/g, " "));
}

/** The index of the bracket that opens the group holding `at`, or -1 at the top level. */
function enclosingOpen(text: string, at: number): number {
  let depth = 0;
  for (let index = at - 1; index >= 0; index--) {
    const char = text.charAt(index);
    if (")]}".includes(char)) depth++;
    else if ("([{".includes(char)) {
      if (depth === 0) return index;
      depth--;
    }
  }
  return -1;
}

/**
 * The `line: text` of each place the catalog is taken other than by a constructor or a free
 * function: a method parameter, a property of an interface, a type or a class, a Pick of it.
 * A parameter of an arrow bound to a name counts as a free function. Limit: a class-property arrow
 * passes the same way, and no source has one.
 */
function catalogParameterViolations(source: string): string[] {
  const code = bareCode(source);
  const lineOf = (at: number): number => code.slice(0, at).split("\n").length;
  const lines = code.split("\n");
  const found = new Set<number>();

  for (const pick of code.matchAll(PICK)) found.add(lineOf(pick.index));
  for (const use of code.matchAll(NAME)) {
    const open = enclosingOpen(code, use.index);
    const isParameter =
      open >= 0 && code[open] === "(" && ALLOWED_LIST_OPENER.test(code.slice(0, open));
    if (!isParameter) found.add(lineOf(use.index));
  }
  return [...found].sort((a, b) => a - b).map((line) => `${line}: ${lines[line - 1]?.trim()}`);
}

describe("the tool catalog comes in by constructor", () => {
  it("is taken by no method, no options type and no Pick", () => {
    const candidates = sourceFiles().filter((file) => IN_SCOPE.test(file));
    // A rule that selects nothing passes forever: this filter named a tree the files left.
    expect(candidates, "the rule selects no known file: its scope is stale").toContain(
      "src/orchestration/setup/run-setup.ts"
    );
    const violations = candidates
      .filter((file) => file !== IS_THE_CATALOG)
      .flatMap((file) => catalogParameterViolations(read(file)).map((hit) => `${file}:${hit}`));

    expect(
      violations,
      "put the catalog in the constructor: private readonly tools: ToolCatalog"
    ).toEqual([]);
  });
});

describe("the guard itself", () => {
  it("sees a method parameter", () => {
    const source = "class A {\n  run(tools: ToolCatalog): void {}\n}";
    expect(catalogParameterViolations(source)).toEqual(["2: run(tools: ToolCatalog): void {}"]);
  });

  it("reports the line of the file when a block comment spans lines above it", () => {
    const source = "/**\n * one\n * two\n */\nclass A {\n  run(tools: ToolCatalog): void {}\n}";
    expect(catalogParameterViolations(source)).toEqual(["6: run(tools: ToolCatalog): void {}"]);
  });

  it("sees an options field read by a method", () => {
    const source =
      "interface Options {\n  tools: ToolCatalog;\n}\nclass A {\n  run(o: Options) {}\n}";
    expect(catalogParameterViolations(source)).toEqual(["2: tools: ToolCatalog;"]);
  });

  it("sees a Pick of the catalog", () => {
    const source =
      "class A {\n  constructor(private readonly tools: Pick<ToolCatalog, 'all'>) {}\n}";
    expect(catalogParameterViolations(source)).toHaveLength(1);
  });

  it("lets a constructor take the catalog", () => {
    const source =
      "class A {\n  constructor(\n    private readonly a: B,\n    private readonly tools: ToolCatalog\n  ) {}\n}";
    expect(catalogParameterViolations(source)).toEqual([]);
  });

  it("lets a free function take the catalog", () => {
    expect(
      catalogParameterViolations("function f(tools: ToolCatalog): number { return 1; }")
    ).toEqual([]);
    expect(catalogParameterViolations("const f = (tools: ToolCatalog) => 1;")).toEqual([]);
  });
});
