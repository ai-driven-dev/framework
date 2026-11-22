/**
 * A folder holds at most FOLDER_CAP source files of its own. The folders over it today are
 * listed with their size and may not grow; one that falls back to the cap, or shrinks, must be
 * written down again, so the list only ever gets shorter.
 */
import { dirname, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC, sourceFiles } from "./source-graph.js";

const FOLDER_CAP = 10;

/** Folders over the cap, by path under `src/`, and how many `.ts` files each holds. */
const OVER_THE_CAP: Readonly<Record<string, number>> = {
  composition: 14,
  "contexts/host-registration/application/withdraw": 13,
  "contexts/host-registration/infrastructure": 11,
  "contexts/installation/application": 11,
  "contexts/installation/application/materialize": 12,
  "contexts/installation/application/plugin": 15,
  "contexts/installation/application/plugin/add": 11,
  "contexts/installation/application/removal": 11,
  "contexts/installation/ports": 14,
  "contexts/machine-claims/application": 12,
  "contexts/telemetry/domain": 14,
  "contexts/tools/domain/formats": 11,
  "contexts/tools/domain/sections": 11,
  "presentation/controllers": 30,
  "presentation/presenters": 15,
  "shared/domain": 14,
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

  it("holds every folder under src to the cap, or to the size written down for it", () => {
    const actual = overTheCap(folderSizes(sourceFiles()), FOLDER_CAP);
    const found = Object.fromEntries(
      [...actual].map(([dir, size]) => [relative(SRC, dir).split("\\").join("/"), size])
    );

    expect(found).toEqual(OVER_THE_CAP);
  });
});
