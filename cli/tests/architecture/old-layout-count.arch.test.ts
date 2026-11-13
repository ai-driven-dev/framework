/**
 * The old layout (`contexts/framework/`, `kernel/`) is being drained into the
 * target one (`shared/`, a context per concern). A folder that only shrinks needs a number
 * that only shrinks: `framework/` is held by its file count, `kernel/` by
 * its path set, because a count alone lets one file be deleted and another added.
 * Delete this file when the two folders are gone.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, sourceFiles } from "./helpers.js";

/** Source files under each folder that is still counted. Lower a value when files leave. */
const COMMITTED_COUNTS: Readonly<Record<string, number>> = {
  "src/contexts/framework/": 126,
};

/** The paths `src/kernel/` holds. It receives no new file; a path leaves when it moves out. */
const COMMITTED_KERNEL_PATHS: readonly string[] = [
  "src/kernel/describe-error.ts",
  "src/kernel/errors.ts",
  "src/kernel/file.ts",
  "src/kernel/markdown.ts",
  "src/kernel/materialization/flat-paths.ts",
  "src/kernel/materialization/plugin-root-path-rewrite.ts",
  "src/kernel/materialization/relative-link-rewrite.ts",
  "src/kernel/merge.ts",
  "src/kernel/paths.ts",
  "src/kernel/ports/asset-provider.ts",
  "src/kernel/ports/file-reader.ts",
  "src/kernel/ports/file-writer.ts",
  "src/kernel/ports/hasher.ts",
  "src/kernel/ports/logger.ts",
  "src/kernel/ports/prompter.ts",
  "src/kernel/ports/version-reader.ts",
  "src/kernel/reading/home-dir.ts",
  "src/kernel/reading/json-file.ts",
  "src/kernel/reading/jsonc.ts",
  "src/kernel/reading/plain-object.ts",
  "src/kernel/reading/text-file.ts",
  "src/kernel/scope.ts",
  "src/kernel/semver.ts",
  "src/kernel/source.ts",
  "src/kernel/tool.ts",
];

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

/** Every difference between the paths found and the paths committed, a swap included. */
function pathSetVerdicts(found: readonly string[], committed: readonly string[]): string[] {
  const held = new Set(committed);
  const present = new Set(found);
  return [
    ...found
      .filter((path) => !held.has(path))
      .map((path) => `${path} is new: nothing new enters the old layout`),
    ...committed
      .filter((path) => !present.has(path))
      .map((path) => `${path} is gone: remove it from the committed set`),
  ];
}

/** The top-level entries of `src/`. A file moved to any other one escapes the counts above. */
const KNOWN_SOURCE_AREAS: ReadonlySet<string> = new Set([
  "cli.ts",
  "composition",
  "contexts",
  "kernel",
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
const GONE_TEST_AREAS: readonly string[] = ["tests/runtime/"];

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

  it("src/kernel/ holds its committed paths, none added and none swapped", () => {
    const found = sourceFiles().filter((file) => file.startsWith("src/kernel/"));

    expect(pathSetVerdicts(found, COMMITTED_KERNEL_PATHS)).toEqual([]);
  });

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

  it("reports a swap in the kernel path set although the count is equal", () => {
    const swapped = [...COMMITTED_KERNEL_PATHS.slice(1), "src/kernel/new-thing.ts"];

    expect(swapped).toHaveLength(COMMITTED_KERNEL_PATHS.length);
    expect(pathSetVerdicts(swapped, COMMITTED_KERNEL_PATHS)).toEqual([
      "src/kernel/new-thing.ts is new: nothing new enters the old layout",
      `${COMMITTED_KERNEL_PATHS[0]} is gone: remove it from the committed set`,
    ]);
  });

  it("reports a file in a top-level src/ area that is not a known one", () => {
    expect(
      unknownAreaVerdicts([
        "src/foo/x.ts",
        "src/cli.ts",
        "src/composition/auth.ts",
        "src/elsewhere/auth.ts",
      ])
    ).toEqual([
      "src/foo/x.ts sits in an unknown top-level area: nothing new enters outside the known ones",
      "src/elsewhere/auth.ts sits in an unknown top-level area: nothing new enters outside the known ones",
    ]);
  });

  it("reports a file recreated under a gone test area and clears its mirror", () => {
    expect(
      goneTestAreaVerdicts(["tests/runtime/wiring/x.unit.test.ts", "tests/kernel/reading/x.ts"])
    ).toEqual([
      "tests/runtime/wiring/x.unit.test.ts sits in a test area whose source area is gone: mirror its source path",
    ]);
  });

  it("reports a removed kernel path and clears the committed set itself", () => {
    expect(pathSetVerdicts(COMMITTED_KERNEL_PATHS.slice(1), COMMITTED_KERNEL_PATHS)).toEqual([
      `${COMMITTED_KERNEL_PATHS[0]} is gone: remove it from the committed set`,
    ]);
    expect(pathSetVerdicts(COMMITTED_KERNEL_PATHS, COMMITTED_KERNEL_PATHS)).toEqual([]);
  });
});
