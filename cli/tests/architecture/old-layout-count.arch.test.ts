/**
 * The old layout (`contexts/framework/`) is being drained into the target one (`shared/`, a
 * context per concern). A folder that only shrinks needs a number that only shrinks:
 * `framework/` is held by its file count. The folders already gone stay gone: no `src/` area
 * and no `tests/` area may be recreated under their old name.
 * Delete this file when `framework/` is gone.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, sourceFiles } from "./helpers.js";

/** Source files under each folder that is still counted. Lower a value when files leave. */
const COMMITTED_COUNTS: Readonly<Record<string, number>> = {
  "src/contexts/framework/": 127,
};

/** Null when `count` is the committed one, else what to do about the difference. */
function countVerdict(folder: string, count: number, committed: number): string | null {
  if (count > committed) {
    return `${folder} went from ${committed} to ${count} files: nothing new enters the old layout`;
  }
  if (count < committed) {
    return `${folder} went from ${committed} to ${count} files: lower the committed value`;
  }
  return null;
}

/** The top-level entries of `src/`. A file moved to any other one escapes the counts above. */
const KNOWN_SOURCE_AREAS: ReadonlySet<string> = new Set([
  "cli.ts",
  "composition",
  "contexts",
  "presentation",
  "shared",
]);

/** Every file under a top-level `src/` entry that is not a known area. */
function unknownAreaVerdicts(found: readonly string[]): string[] {
  return found
    .filter((path) => !KNOWN_SOURCE_AREAS.has(path.split("/")[1] as string))
    .map(
      (path) =>
        `${path} sits in an unknown top-level area: nothing new enters outside the known ones`
    );
}

/** Folders of `tests/` that mirrored a `src/` area now gone. A file recreated there is a test
 * mirroring nothing. */
const GONE_TEST_AREAS: readonly string[] = ["tests/kernel/", "tests/runtime/"];

/** Every file under a test area whose source area is gone. */
function goneTestAreaVerdicts(found: readonly string[]): string[] {
  return found
    .filter((path) => GONE_TEST_AREAS.some((area) => path.startsWith(area)))
    .map((path) => `${path} sits in a test area whose source area is gone: mirror its source path`);
}

function testFiles(): string[] {
  return readdirSync(join(CLI_ROOT, "tests"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      `tests/${join(entry.parentPath, entry.name).slice(join(CLI_ROOT, "tests").length + 1)}`.replace(
        /\\/g,
        "/"
      )
    );
}

describe("the old layout only shrinks", () => {
  for (const [folder, committed] of Object.entries(COMMITTED_COUNTS)) {
    it(`${folder} holds its committed file count`, () => {
      const count = sourceFiles().filter((file) => file.startsWith(folder)).length;

      expect(countVerdict(folder, count, committed) ?? "").toBe("");
    });
  }

  it("src/ holds no top-level area beyond the known ones", () => {
    expect(unknownAreaVerdicts(sourceFiles())).toEqual([]);
  });

  it("tests/ holds no file under a test area whose source area is gone", () => {
    expect(goneTestAreaVerdicts(testFiles())).toEqual([]);
  });
});

describe("the guard itself", () => {
  it("says what to do about a count one above or one below the committed value", () => {
    expect(countVerdict("src/contexts/framework/", 40, 39)).toContain("nothing new enters");
    expect(countVerdict("src/contexts/framework/", 38, 39)).toContain("lower the committed value");
    expect(countVerdict("src/contexts/framework/", 39, 39)).toBeNull();
  });

  it("reports a file in a top-level src/ area that is not a known one", () => {
    expect(
      unknownAreaVerdicts([
        "src/foo/x.ts",
        "src/kernel/errors.ts",
        "src/cli.ts",
        "src/composition/auth.ts",
        "src/elsewhere/auth.ts",
      ])
    ).toEqual([
      "src/foo/x.ts sits in an unknown top-level area: nothing new enters outside the known ones",
      "src/kernel/errors.ts sits in an unknown top-level area: nothing new enters outside the known ones",
      "src/elsewhere/auth.ts sits in an unknown top-level area: nothing new enters outside the known ones",
    ]);
  });

  it("reports a file recreated under a gone test area and clears its mirror", () => {
    expect(
      goneTestAreaVerdicts([
        "tests/runtime/wiring/x.unit.test.ts",
        "tests/kernel/reading/x.ts",
        "tests/shared/domain/x.ts",
      ])
    ).toEqual([
      "tests/runtime/wiring/x.unit.test.ts sits in a test area whose source area is gone: mirror its source path",
      "tests/kernel/reading/x.ts sits in a test area whose source area is gone: mirror its source path",
    ]);
  });
});
