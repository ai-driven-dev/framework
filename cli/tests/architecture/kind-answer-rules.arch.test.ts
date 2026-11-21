/**
 * The answer rules of the kind gate (`kind-answer-rules.ts`): a section declares nothing nobody
 * calls, and a plugin answer is asked, never read. Each is held to the case it names and then to
 * the real tree, with no violation tolerated.
 */
import { describe, expect, it } from "vitest";
import {
  answerViolations,
  STORED_ANSWERS,
  sectionViolations,
  storedValueViolations,
} from "./kind-answer-rules.js";
import { entries, expectNone, src } from "./kind-rule-fixtures.js";

describe("a section declares nothing nobody calls", () => {
  const section = "src/contexts/tools/domain/sections/thing-section.ts";
  const thing = [
    "export class ThingSection {",
    "  used(): string {",
    "    return this.inner();",
    "  }",
    "  inner(): string {",
    '    return "x";',
    "  }",
    "  merge(a: string, b: string): string {",
    "    return b;",
    "  }",
    "}",
  ].join("\n");
  const found = (caller: string) =>
    entries(
      sectionViolations(
        new Map([
          [section, thing],
          ["src/contexts/framework/application/caller.ts", caller],
        ])
      )
    );

  it("names the method nobody calls, and clears the ones a section receiver calls", () => {
    expect(found("tool.sections.thing.used();")).toEqual([`${section} :: ThingSection.merge`]);
    expect(found("section.used();\nresolveThingSection(id)?.merge(a, b);")).toEqual([]);
  });

  it("does not read another type's method of the same name as a call to the section's", () => {
    expect(found("cap.used();\nformat.merge(a, b);")).toEqual([`${section} :: ThingSection.merge`]);
  });

  it("holds the sections of the tree, and finds them", () => {
    const files = src();
    expect(
      Object.keys(files).filter((path) => /\/domain\/sections\//.test(path)).length,
      "the scope is stale"
    ).toBeGreaterThan(5);
    expectNone(sectionViolations(new Map(Object.entries(files))));
  });
});

describe("a plugin answer is asked, never read", () => {
  const file = "src/contexts/tools/domain/sections/x-section.ts";
  const found = (text: string) => entries(answerViolations({ [file]: text }));

  it("flags a public field, a parameter property and a getter handing back a stored value", () => {
    expect(found("export class X {\n  outputPath = 1;\n}")).toEqual([`${file} :: X.outputPath`]);
    expect(found("export class X {\n  constructor(readonly path: string) {}\n}")).toEqual([
      `${file} :: X.path`,
    ]);
    expect(found("export class X {\n  get path() { return this.#path; }\n}")).toEqual([
      `${file} :: X.path`,
    ]);
  });

  it("passes a # field behind a method that computes", () => {
    expect(
      found(
        "export class X {\n  #path = 1;\n  path(root: string) { return join(root, this.#path); }\n}"
      )
    ).toEqual([]);
  });

  it("clears a stored value the list keeps for a caller that needs it as it is", () => {
    const [kept] = STORED_ANSWERS;
    const source = `export class ${kept.member.split(".")[0]} {\n  ${kept.member.split(".")[1]}() { return this.#v; }\n}`;
    expect(storedValueViolations({ [kept.file]: source })).toHaveLength(1);
    expect(answerViolations({ [kept.file]: source })).toEqual([]);
  });

  it("keeps in the list only a stored value the tree still hands out, with its caller and reason", () => {
    const flagged = new Set(storedValueViolations(src()).map((v) => v.entry));
    for (const entry of STORED_ANSWERS) {
      expect(flagged.has(`${entry.file} :: ${entry.member}`)).toBe(true);
      expect(entry.caller).not.toBe("");
      expect(entry.reason).not.toBe("");
    }
  });

  it("holds the plugin answers of the tree", () => {
    expectNone(answerViolations(src()));
  });
});
