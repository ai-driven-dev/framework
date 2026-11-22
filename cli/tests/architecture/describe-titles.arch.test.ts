/**
 * A `describe` names a situation ("when the manifest is missing"), not a bare identifier. The
 * titles that are still one identifier are counted and may not grow; each one reworded lowers the
 * count, which is then written down again, so the number only ever gets smaller.
 */
import { describe, expect, it } from "vitest";
import { read, tsFilesUnder } from "./source-graph.js";

const BARE_TITLES_TODAY = 780;

const THIS_FILE = "tests/architecture/describe-titles.arch.test.ts";
const DESCRIBE_TITLE = /\bdescribe(?:\.[a-zA-Z]+)?\(\s*(["'`])([^"'`]*)\1/g;

/** The titles of the `describe` calls in a text that hold no whitespace: one identifier, no situation. */
function bareTitles(text: string): string[] {
  return [...text.matchAll(DESCRIBE_TITLE)]
    .map((match) => match[2] ?? "")
    .filter((title) => !/\s/.test(title));
}

describe("describe titles", () => {
  it("reads a one-word title as bare and a sentence as a situation", () => {
    const planted = [
      'describe("AddPlugin", () => {});',
      "describe.skip('toJSON()', () => {});",
      "describe(\n  `capabilities.mcp`,\n  () => {}\n);",
      'describe("when the plugin is installed in two scopes", () => {});',
      'describe.each(rows)("rows", () => {});',
    ].join("\n");

    expect(bareTitles(planted)).toEqual(["AddPlugin", "toJSON()", "capabilities.mcp"]);
  });

  it("holds the suite to the count of bare titles written down", () => {
    const count = tsFilesUnder("tests")
      .filter((path) => path.endsWith(".test.ts") && path !== THIS_FILE)
      .reduce((total, path) => total + bareTitles(read(path)).length, 0);

    expect(
      count,
      "a describe title must name a situation; reword it, or lower BARE_TITLES_TODAY when the count fell"
    ).toBeLessThanOrEqual(BARE_TITLES_TODAY);
  });
});
