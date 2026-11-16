/**
 * A tolerated list is a debt, and a debt only goes down. Each list the architecture tests
 * declare under a name ending in `BASELINE` is compared with the size committed below: a list
 * that grew fails, and a list that shrank requires the committed size to be lowered, so the
 * gain cannot be spent again later. A list no one committed counts as empty, so a new one
 * cannot start with entries.
 *
 * Only the top-level entries of a list are counted. Raising a count or a method list inside an
 * entry is held by the test that owns the list, which pins each of them exactly. The committed
 * sizes sit in this file, so raising one is a visible edit, not a block: it is read at review,
 * and CI replays the commit it sits in against itself.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, read } from "./helpers.js";
import { closingBracket, codeOnly, topLevelPieces } from "./source-shapes.js";

/** List id (`file#NAME`) to its committed number of entries. Lower a value when entries leave. */
const COMMITTED_SIZES: Readonly<Record<string, number>> = {
  "tests/architecture/catches-that-swallow.arch.test.ts#BASELINE": 5,
  "tests/architecture/folder-size.arch.test.ts#BASELINE": 2,
  "tests/architecture/orchestrator-deps.arch.test.ts#BASELINE": 6,
  "tests/architecture/ports-are-called.arch.test.ts#OPTIONAL_BASELINE": 1,
  "tests/architecture/ports-are-called.arch.test.ts#SECTION_BASELINE": 5,
  "tests/architecture/test-file-size.arch.test.ts#BASELINE": 8,
  "tests/architecture/tool-addition-cost.arch.test.ts#IDENTIFIER_BASELINE": 4,
  "tests/architecture/unit-tests-reading-disk.arch.test.ts#BASELINE": 15,
};

/** Entries of each list declared as `const <...>BASELINE<...> = [` or `= {` in `text`. */
function declaredListSizes(file: string, text: string): Map<string, number> {
  const code = codeOnly(text);
  const sizes = new Map<string, number>();
  for (const declaration of code.matchAll(/\bconst (\w*BASELINE\w*)\b/g)) {
    const afterName = declaration.index + declaration[0].length;
    const assignment = /=(?!>)\s*([[{])/.exec(code.slice(afterName));
    if (!assignment) continue;
    const open = afterName + assignment.index + assignment[0].length - 1;
    const entries = topLevelPieces(code.slice(open + 1, closingBracket(code, open))).length;
    sizes.set(`${file}#${declaration[1]}`, entries);
  }
  return sizes;
}

/** What to do about each list whose size is not the committed one, in the order of the ids. */
function verdicts(
  declared: ReadonlyMap<string, number>,
  committed: Readonly<Record<string, number>>
): string[] {
  const ids = new Set([...declared.keys(), ...Object.keys(committed)]);
  return [...ids].sort().flatMap((id) => {
    const size = declared.get(id) ?? 0;
    const was = committed[id] ?? 0;
    if (size > was)
      return [`${id} went from ${was} to ${size} entries: a tolerated list only shrinks`];
    if (size < was) return [`${id} went from ${was} to ${size} entries: lower the committed size`];
    return [];
  });
}

function architectureFiles(): string[] {
  return readdirSync(join(CLI_ROOT, "tests", "architecture"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `tests/architecture/${name}`)
    .sort();
}

function declaredInTree(): Map<string, number> {
  return new Map(architectureFiles().flatMap((file) => [...declaredListSizes(file, read(file))]));
}

describe("tolerated lists only shrink", () => {
  it("every list holds the size committed for it", () => {
    expect(verdicts(declaredInTree(), COMMITTED_SIZES)).toEqual([]);
  });

  it("reads the lists of the tree, so a rule selecting none cannot pass", () => {
    expect(declaredInTree().size).toBeGreaterThan(10);
  });
});

describe("the guard itself", () => {
  const list = (body: string) => declaredListSizes("a.ts", body);

  it("counts the entries of a list of strings, of objects and of a record", () => {
    expect(list('const BASELINE: readonly string[] = ["a", "b", "c"];').get("a.ts#BASELINE")).toBe(
      3
    );
    expect(
      list("const X_BASELINE = [{ path: 'a', n: 1, tags: [1, 2] }, { path: 'b', n: 2 }];").get(
        "a.ts#X_BASELINE"
      )
    ).toBe(2);
    expect(
      list(
        'const BASELINE: Readonly<Record<string, { count: number }>> = { "a": { count: 1 }, "b": { count: 2 } };'
      ).get("a.ts#BASELINE")
    ).toBe(2);
    expect(list("const BASELINE: string[] = [];").get("a.ts#BASELINE")).toBe(0);
  });

  it("reads a comma or a bracket inside a comment or a string as nothing", () => {
    expect(
      list('const BASELINE = [\n  // a, b, c\n  "x, y]",\n  "z", // [\n];').get("a.ts#BASELINE")
    ).toBe(2);
  });

  it("fails a list that grew, and one that started with entries", () => {
    const grown = verdicts(new Map([["a.ts#BASELINE", 3]]), { "a.ts#BASELINE": 2 });
    expect(grown).toEqual([
      "a.ts#BASELINE went from 2 to 3 entries: a tolerated list only shrinks",
    ]);
    const born = verdicts(new Map([["b.ts#NEW_BASELINE", 1]]), {});
    expect(born).toEqual([
      "b.ts#NEW_BASELINE went from 0 to 1 entries: a tolerated list only shrinks",
    ]);
  });

  it("asks for the committed size to be lowered when a list shrank or went away", () => {
    expect(verdicts(new Map([["a.ts#BASELINE", 1]]), { "a.ts#BASELINE": 2 })).toEqual([
      "a.ts#BASELINE went from 2 to 1 entries: lower the committed size",
    ]);
    expect(verdicts(new Map(), { "a.ts#BASELINE": 2 })).toEqual([
      "a.ts#BASELINE went from 2 to 0 entries: lower the committed size",
    ]);
  });
});
