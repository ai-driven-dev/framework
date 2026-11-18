/**
 * A test file past 800 lines stops being one situation and becomes a pile: a reader cannot hold
 * it, and the next case lands wherever there is room. 400 lines is a review point, not checked.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, expectRatchet, read } from "./helpers.js";

const MAX_LINES = 800;

// Test files over the cap, each with the lines it carries. An entry leaves when its file is
// split under the cap, and a shorter file lowers its count.
// Limit: raising a count in the same change that grows the file passes; the diff of this list
// is where that is reviewed.
const BASELINE: Readonly<Record<string, number>> = {
  "tests/orchestration/clean/clean-native-cache.integration.test.ts": 1015,
  "tests/orchestration/clean/clean-use-case.unit.test.ts": 3093,
  "tests/orchestration/clean/clean-user-scope.integration.test.ts": 1906,
  "tests/orchestration/sync/marketplace-sync-native-activation.integration.test.ts": 1034,
  "tests/orchestration/sync/marketplace-sync-settings-migration.integration.test.ts": 1506,
  "tests/contexts/installation/application/plugin/add-plugin.unit.test.ts": 1126,
  "tests/contexts/installation/application/plugin/plugin-remove-native-activation.integration.test.ts": 933,
  "tests/contexts/installation/application/plugin/plugin-update-built-tree.unit.test.ts": 845,
};

/** Lines as `wc -l` counts them: one per newline character. */
function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

function testFiles(): string[] {
  return readdirSync(join(CLI_ROOT, "tests"), { recursive: true, encoding: "utf8" })
    .map((entry) => join("tests", entry).split(sep).join("/"))
    .filter((path) => path.endsWith(".test.ts") && !path.startsWith("tests/fixtures/"))
    .sort();
}

function measuredCounts(): Map<string, number> {
  return new Map(testFiles().map((path) => [path, lineCount(read(path))]));
}

/** The grandfathered files whose line count differs from the recorded one, with the direction. */
function driftFromBaseline(
  counts: ReadonlyMap<string, number>,
  baseline: Readonly<Record<string, number>>
): { grown: string[]; shrunk: string[] } {
  const entries = Object.entries(baseline).flatMap(([path, recorded]) => {
    const lines = counts.get(path);
    return lines === undefined ? [] : [{ path, recorded, lines }];
  });
  return {
    grown: entries.filter((e) => e.lines > e.recorded).map((e) => e.path),
    shrunk: entries.filter((e) => e.lines < e.recorded).map((e) => e.path),
  };
}

function overLimit(counts: ReadonlyMap<string, number>): string[] {
  return [...counts]
    .filter(([, lines]) => lines > MAX_LINES)
    .map(([path]) => path)
    .sort();
}

function measuredOverLimit(): string[] {
  return overLimit(measuredCounts());
}

describe("test files stay small enough to hold in mind", () => {
  it("no test file carries more than 800 lines", () => {
    const { added } = expectRatchet(measuredOverLimit(), Object.keys(BASELINE));
    expect(added, "new test file over 800 lines: split it by situation").toEqual([]);
  });

  it("lists no file that fits the cap again", () => {
    const { fixed } = expectRatchet(measuredOverLimit(), Object.keys(BASELINE));
    expect(fixed, "under 800 lines now: remove it from BASELINE").toEqual([]);
  });
});

describe("a test file over the cap does not keep growing", () => {
  it("holds every grandfathered file at the lines it was recorded with", () => {
    const { grown } = driftFromBaseline(measuredCounts(), BASELINE);
    expect(grown, "grandfathered file grew: split it by situation instead").toEqual([]);
  });

  it("records the lines a grandfathered file has now", () => {
    const { shrunk } = driftFromBaseline(measuredCounts(), BASELINE);
    expect(shrunk, "shorter than recorded: lower its count in BASELINE").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("names a file past its recorded lines as grown and one under them as shrunk", () => {
    const counts = new Map([
      ["tests/grew.test.ts", 11],
      ["tests/same.test.ts", 10],
      ["tests/shrank.test.ts", 9],
    ]);
    const baseline = {
      "tests/grew.test.ts": 10,
      "tests/same.test.ts": 10,
      "tests/shrank.test.ts": 10,
    };
    expect(driftFromBaseline(counts, baseline)).toEqual({
      grown: ["tests/grew.test.ts"],
      shrunk: ["tests/shrank.test.ts"],
    });
  });

  it("counts 801 lines as over and 800 as not", () => {
    const counts = new Map([
      ["tests/over.test.ts", lineCount("x\n".repeat(801))],
      ["tests/at.test.ts", lineCount("x\n".repeat(800))],
    ]);
    expect(overLimit(counts)).toEqual(["tests/over.test.ts"]);
  });

  it("names a new offender in added and a stale entry in fixed", () => {
    expect(expectRatchet(["tests/over.test.ts"], []).added).toEqual(["tests/over.test.ts"]);
    expect(expectRatchet([], ["tests/gone.test.ts"]).fixed).toEqual(["tests/gone.test.ts"]);
  });

  it("walks tests/ and finds this file", () => {
    expect(testFiles()).toContain("tests/architecture/test-file-size.arch.test.ts");
  });
});
