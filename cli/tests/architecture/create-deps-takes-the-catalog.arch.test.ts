/**
 * `createDeps` requires its catalog, so a caller that omits it fails to compile. This guard
 * reads `src/` alone, where the argument count is the whole contract: a call that hands fewer
 * builds a graph from a catalog nobody handed in.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./helpers.js";

const ARGUMENTS_A_CALL_PASSES = 4;
const CALL = /(?<!function\s)\bcreateDeps\(/g;

/** The number of top-level arguments of each `createDeps(` call in `source`. */
function argumentCounts(source: string): number[] {
  const counts: number[] = [];
  for (const match of source.matchAll(CALL)) {
    let depth = 1;
    let count = 0;
    let sawArgument = false;
    for (let i = match.index + match[0].length; depth > 0 && i < source.length; i += 1) {
      const char = source[i];
      if ("([{".includes(char)) depth += 1;
      else if (")]}".includes(char)) depth -= 1;
      else if (char === "," && depth === 1) {
        count += 1;
        sawArgument = false;
        continue;
      }
      if (depth > 0 && !/\s/.test(char)) sawArgument = true;
    }
    counts.push(count + (sawArgument ? 1 : 0));
  }
  return counts;
}

describe("every createDeps call hands the catalog", () => {
  it("passes all four arguments wherever src calls it", () => {
    const short = sourceFiles().filter((file) =>
      argumentCounts(read(file)).some((count) => count !== ARGUMENTS_A_CALL_PASSES)
    );

    expect(short, "createDeps called without the catalog: pass it as the fourth argument").toEqual(
      []
    );
  });
});

describe("the guard itself", () => {
  it("counts the arguments of a call, however it is broken across lines", () => {
    expect(argumentCounts("await createDeps(root, { verbose }, output);")).toEqual([3]);
    expect(
      argumentCounts("createDeps(\n  root,\n  { verbose: a, b },\n  output,\n  tools\n)")
    ).toEqual([4]);
    expect(argumentCounts("createDeps(root, opts, out, tools,)")).toEqual([4]);
  });

  it("ignores the declaration", () => {
    expect(argumentCounts("export async function createDeps(root: string) {}")).toEqual([]);
  });
});
