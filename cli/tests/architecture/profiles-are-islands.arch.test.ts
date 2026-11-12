/**
 * A tool evolves inside its own folder: a profile that imports another profile's file is edited
 * whenever that other tool changes. What two tools share goes to `domain/formats/`,
 * `domain/hooks/` or `domain/bridges/`, owned by neither.
 */
import { describe, expect, it } from "vitest";
import { INTERNAL_IMPORT, read, resolveImportTarget, sourceFiles } from "./helpers.js";

const PROFILE_FILE = /^src\/contexts\/tools\/domain\/profiles\/([^/]+)\/.+\.ts$/;
const PROFILE_FOLDER = /^src\/contexts\/tools\/domain\/profiles\/([^/]+)\//;

/** `<importer> -> <target>` for every import from one profile folder into another. A specifier
 * naming no file of the tree is text a bridge generates, not an import of this one. */
function crossProfileImports(sources: ReadonlyMap<string, string>): string[] {
  const found: string[] = [];
  for (const [file, text] of sources) {
    const owner = PROFILE_FILE.exec(file)?.[1];
    if (owner === undefined) continue;
    for (const match of text.matchAll(INTERNAL_IMPORT)) {
      const target = resolveImportTarget(file, match[1] as string);
      if (!sources.has(target)) continue;
      const other = PROFILE_FOLDER.exec(target)?.[1];
      if (other !== undefined && other !== owner) found.push(`${file} -> ${target}`);
    }
  }
  return found.sort();
}

describe("profiles are islands", () => {
  it("has no profile importing a file of another profile", () => {
    const sources = new Map(sourceFiles().map((file) => [file, read(file)]));

    expect(sources.size).toBeGreaterThan(0);
    expect(crossProfileImports(sources)).toEqual([]);
  });
});
