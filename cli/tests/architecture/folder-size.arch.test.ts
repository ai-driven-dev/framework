/** A folder holds at most FOLDER_CAP source files of its own. */
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, SRC, sourceFiles } from "./source-graph.js";

const FOLDER_CAP = 10;

/** Folders under src that grow with the product, by design: folder => reason. */
const GROWS_BY_DESIGN: Readonly<Record<string, string>> = {
  "composition/tool-profiles": "one file per registered tool",
};

function folderSizes(files: readonly string[]): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const file of files) sizes.set(dirname(file), (sizes.get(dirname(file)) ?? 0) + 1);
  return sizes;
}

function overTheCap(sizes: ReadonlyMap<string, number>, cap: number): Map<string, number> {
  return new Map([...sizes].filter(([, size]) => size > cap));
}

describe("folder size", () => {
  it("counts the files a folder holds directly, and keeps the folders over the cap", () => {
    const sizes = folderSizes(["a/x.ts", "a/y.ts", "a/b/z.ts"]);

    expect(overTheCap(sizes, 1)).toEqual(new Map([["a", 2]]));
  });

  it("holds every folder under src to the cap", () => {
    const actual = overTheCap(folderSizes(sourceFiles()), FOLDER_CAP);
    const found = Object.fromEntries(
      [...actual]
        .map(([dir, size]) => [relative(SRC, resolve(CLI_ROOT, dir)).split("\\").join("/"), size])
        .filter(([dir]) => !(dir in GROWS_BY_DESIGN))
    );

    expect(found).toEqual({});
  });

  it("lists only folders that exist", () => {
    const folders = new Set(
      sourceFiles().map((file) =>
        relative(SRC, resolve(CLI_ROOT, dirname(file)))
          .split("\\")
          .join("/")
      )
    );

    expect(Object.keys(GROWS_BY_DESIGN).filter((dir) => !folders.has(dir))).toEqual([]);
  });
});
