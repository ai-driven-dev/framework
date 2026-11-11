/**
 * A test file past 800 lines stops being one situation and becomes a pile: a reader cannot hold
 * it, and the next case lands wherever there is room. 400 lines is a review point, not checked.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, expectRatchet, read } from "./helpers.js";

const MAX_LINES = 800;

// Test files over the cap. The list may only shrink: an entry leaves when its file is split.
const BASELINE: readonly string[] = [
  "tests/contexts/framework/application/clean-native-cache.integration.test.ts",
  "tests/contexts/framework/application/clean-use-case.unit.test.ts",
  "tests/contexts/framework/application/clean/clean-user-scope-use-case.integration.test.ts",
  "tests/contexts/framework/application/flows/marketplace-sync-machine-projection.integration.test.ts",
  "tests/contexts/framework/application/flows/marketplace-sync-native-activation.integration.test.ts",
  "tests/contexts/framework/application/flows/marketplace-sync-recovery-contract.integration.test.ts",
  "tests/contexts/framework/application/flows/marketplace-sync-settings-migration.integration.test.ts",
  "tests/contexts/framework/application/plugin/plugin-add-use-case.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-remove-native-activation.integration.test.ts",
  "tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts",
  "tests/contexts/framework/application/recipes/validate-recipes.integration.test.ts",
  "tests/contexts/telemetry/application/ingest-usage-use-case.unit.test.ts",
  "tests/contexts/telemetry/consent-scenarios.integration.test.ts",
  "tests/contexts/translate/application/strategies/flat-build-strategy.integration.test.ts",
];

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

function overLimit(counts: ReadonlyMap<string, number>): string[] {
  return [...counts]
    .filter(([, lines]) => lines > MAX_LINES)
    .map(([path]) => path)
    .sort();
}

function measuredOverLimit(): string[] {
  return overLimit(new Map(testFiles().map((path) => [path, lineCount(read(path))])));
}

describe("test files stay small enough to hold in mind", () => {
  it("no test file carries more than 800 lines", () => {
    const { added } = expectRatchet(measuredOverLimit(), BASELINE);
    expect(added, "new test file over 800 lines: split it by situation").toEqual([]);
  });

  it("lists no file that fits the cap again", () => {
    const { fixed } = expectRatchet(measuredOverLimit(), BASELINE);
    expect(fixed, "under 800 lines now: remove it from BASELINE").toEqual([]);
  });
});

describe("the guard itself", () => {
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
