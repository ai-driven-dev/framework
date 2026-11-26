/**
 * The source spelling of a plugin's root variable is written once, in shared, and every other
 * module imports it: a second literal is a second place to drift from the first.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

const OWNER = "src/shared/domain/materialization/plugin-root-path-rewrite.ts";

function codeLines(text: string): string[] {
  return text.split("\n").filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
}

describe("plugin root literal", () => {
  it("is spelled in one module only", () => {
    const spelling = sourceFiles().filter((file) =>
      codeLines(read(file)).some((line) => line.includes("CLAUDE_PLUGIN_ROOT"))
    );

    expect(spelling).toEqual([OWNER]);
  });
});
