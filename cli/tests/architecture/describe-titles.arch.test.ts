/**
 * A `describe` names a situation ("when the manifest is missing"), not a bare identifier. No title
 * of the suite is one identifier; the fixtures under `tests/fixtures/` are data, not the suite.
 */
import { describe, expect, it } from "vitest";
import { read, tsFilesUnder } from "./source-graph.js";

const THIS_FILE = "tests/architecture/describe-titles.arch.test.ts";
const DESCRIBE_TITLE = /\bdescribe(?:\.[a-zA-Z]+)?\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

/** The titles of the `describe` calls in a text that hold no whitespace: one identifier, no situation. */
function bareTitles(text: string): string[] {
  return [...text.matchAll(DESCRIBE_TITLE)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
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
      'describe("cursor\'s", () => {});',
      'describe("cursor\'s hooks", () => {});',
    ].join("\n");

    expect(bareTitles(planted)).toEqual(["AddPlugin", "toJSON()", "capabilities.mcp", "cursor's"]);
  });

  it("finds no bare title in the suite", () => {
    const bare = tsFilesUnder("tests")
      .filter(
        (path) =>
          path.endsWith(".test.ts") && path !== THIS_FILE && !path.startsWith("tests/fixtures/")
      )
      .flatMap((path) => bareTitles(read(path)).map((title) => `${path}: ${title}`));

    expect(bare, "a describe title must name a situation; reword it").toEqual([]);
  });
});
