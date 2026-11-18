/** A test of a context imports its own kit and the shared one, never another context's kit. */
import { describe, expect, it } from "vitest";
import { INTERNAL_IMPORT, read, resolveImportTarget, tsFilesUnder } from "./helpers.js";

/** The context a `tests/contexts/<name>/` path belongs to, or null. */
const contextOfTest = (path: string): string | null =>
  /^tests\/contexts\/([^/]+)\//.exec(path)?.[1] ?? null;

/** The context whose kit `target` sits in, or null. */
const kitOwner = (target: string): string | null =>
  /^tests\/contexts\/([^/]+)\/testing\//.exec(target)?.[1] ?? null;

function foreignKitImports(file: string, source: string): string[] {
  const own = contextOfTest(file);
  if (own === null) return [];
  return [...source.matchAll(INTERNAL_IMPORT)].flatMap((match) => {
    const specifier = match[1] ?? "";
    const owner = kitOwner(resolveImportTarget(file, specifier));
    return owner !== null && owner !== own
      ? [`${file}: imports the kit of ${owner}: ${specifier}`]
      : [];
  });
}

describe("a test never imports another context's kit", () => {
  it("holds across tests/contexts", () => {
    const files = tsFilesUnder("tests/contexts");
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap((file) => foreignKitImports(file, read(file)))).toEqual([]);
  });

  it("flags a foreign kit, however it is spelled", () => {
    const test = "tests/contexts/a/x/y.test.ts";
    expect(foreignKitImports(test, `import { f } from "../../b/testing/k.js";`)).toHaveLength(1);
    expect(foreignKitImports(test, `import "../../b/testing/k.js";`)).toHaveLength(1);
    expect(foreignKitImports(test, `import type { F } from "../../b/testing/k.js";`)).toHaveLength(
      1
    );
  });

  it("clears the context's own kit and the shared kit", () => {
    const test = "tests/contexts/a/x/y.test.ts";
    expect(foreignKitImports(test, `import { f } from "../../a/testing/k.js";`)).toEqual([]);
    expect(foreignKitImports(test, `import { f } from "../../../shared/testing/k.js";`)).toEqual(
      []
    );
  });
});
