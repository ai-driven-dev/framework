/**
 * A `.golden.test.ts` file compares an output to a versioned snapshot through `expectGolden`;
 * the suffix names the level and must not lie. A test that asserts inline is a unit test and
 * carries that suffix. No file is excepted.
 */
import { describe, expect, it } from "vitest";
import { read, tsFilesUnder } from "./source-graph.js";

function inlineGoldens(files: Readonly<Record<string, string>>): string[] {
  return Object.entries(files)
    .filter(([file, text]) => file.endsWith(".golden.test.ts") && !text.includes("expectGolden("))
    .map(([file]) => file);
}

describe("golden tests", () => {
  it("flags a golden file that compares no snapshot, and only that one", () => {
    const found = inlineGoldens({
      "tests/a/inline.golden.test.ts": "expect(render()).toBe('x');",
      "tests/a/snapshot.golden.test.ts": "await expectGolden(render());",
      "tests/a/inline.unit.test.ts": "expect(render()).toBe('x');",
    });

    expect(found).toEqual(["tests/a/inline.golden.test.ts"]);
  });

  it("holds every golden file to a snapshot comparison", () => {
    const files = Object.fromEntries(tsFilesUnder("tests").map((file) => [file, read(file)]));

    expect(inlineGoldens(files)).toEqual([]);
  });
});
