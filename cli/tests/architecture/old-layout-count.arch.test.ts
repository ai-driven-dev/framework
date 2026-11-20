/**
 * No `src/` area and no `tests/` area may be recreated under the name of a folder already
 * gone. A context recreated under `src/contexts/` is caught by `edge-table`, which
 * reads the contexts on disk against the biome overrides.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.js";
import { CLI_ROOT, sourceFiles } from "./helpers.js";

/** The top-level entries of `src/`. A file moved to any other one escapes every rule written per area. */
const KNOWN_SOURCE_AREAS: ReadonlySet<string> = new Set([
  "cli.ts",
  "composition",
  "contexts",
  "orchestration",
  "presentation",
  "shared",
]);

/** Every file under a top-level `src/` entry that is not a known area. */
function unknownAreaVerdicts(found: readonly string[]): string[] {
  return found
    .filter((path) => !KNOWN_SOURCE_AREAS.has(present(path.split("/")[1])))
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

describe("the old layout stays gone", () => {
  it("src/ holds no top-level area beyond the known ones", () => {
    expect(unknownAreaVerdicts(sourceFiles())).toEqual([]);
  });

  it("tests/ holds no file under a test area whose source area is gone", () => {
    expect(goneTestAreaVerdicts(testFiles())).toEqual([]);
  });
});

describe("the guard itself", () => {
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
