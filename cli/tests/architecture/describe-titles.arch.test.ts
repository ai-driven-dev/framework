/**
 * A `describe` names a situation, never the identifier under test: a title like `parsePlugin`
 * says where the code is, not what is held. The files that still carry such titles are listed
 * with how many in the baseline file, and may not grow; renaming one must be written down again, so the list only
 * ever gets shorter. A title this reads is a plain string literal; a computed one is out of sight.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, canonicalPath, tsFilesUnder } from "./source-graph.js";

const DESCRIBE_TITLE = /\bdescribe(?:\.\w+)?\(\s*(["'`])((?:(?!\1).)*)\1/g;
const IDENTIFIER_TITLE = /^[A-Za-z_$][\w$]*(?:[.#][\w$]+)*(?:\(\))?$/;

function writtenDown(): Record<string, number> {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL("describe-titles-baseline.json", import.meta.url), "utf8")
  );
  if (typeof parsed !== "object" || parsed === null) throw new Error("baseline is not an object");
  return Object.fromEntries(
    Object.entries(parsed).map(([file, count]) => {
      if (typeof count !== "number") throw new Error(`baseline count for ${file} is not a number`);
      return [file, count];
    })
  );
}

function bareTitles(source: string): string[] {
  return [...source.matchAll(DESCRIBE_TITLE)]
    .map((match) => match[2] ?? "")
    .filter((title) => IDENTIFIER_TITLE.test(title));
}

function bareTitleCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of tsFilesUnder("tests")) {
    if (!file.endsWith(".test.ts") || /(^|\/)(fixtures|snapshots)\//.test(file)) continue;
    const found = bareTitles(readFileSync(`${CLI_ROOT}/${canonicalPath(file)}`, "utf8")).length;
    if (found > 0) counts[file] = found;
  }
  return counts;
}

describe("describe titles", () => {
  it("flags an identifier, a dotted name and a backtick title, and passes a situation", () => {
    const wrap = (title: string, call = "describe") => `${call}(${title}, () => {});`;
    const source = [
      wrap('"parsePlugin"'),
      wrap("'Manifest.load'"),
      wrap("'confirm()'", "describe.each(rows)"),
      wrap('"when the manifest is missing"'),
      wrap("`load`"),
    ].join("\n");

    expect(bareTitles(source)).toEqual(["parsePlugin", "Manifest.load", "load"]);
  });

  it("holds every test file to the bare titles written down for it", () => {
    expect(bareTitleCounts()).toEqual(writtenDown());
  });
});
