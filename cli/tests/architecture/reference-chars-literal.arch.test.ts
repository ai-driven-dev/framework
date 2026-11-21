/**
 * What one reference to a file is made of is spelled once, in the tools contract, and every reader
 * of a reference imports it: a second spelling is a second place to drift from the first.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

const OWNER = "src/contexts/tools/contract/link-syntax.ts";
const SPELLING = "[^\\\\s`'\\\">,]";

function codeLines(text: string): string[] {
  return text.split("\n").filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
}

describe("reference characters", () => {
  it("are spelled in one module only", () => {
    const spelling = sourceFiles().filter((file) =>
      codeLines(read(file)).some((line) => line.includes(SPELLING))
    );

    expect(spelling).toEqual([OWNER]);
  });
});
