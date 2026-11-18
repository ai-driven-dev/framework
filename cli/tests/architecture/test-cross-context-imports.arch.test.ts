/**
 * A test of a context reaches another context's source through its `application/` or
 * `contract/`, through `src/shared` and through `src/composition`, never through its `domain/` or
 * `infrastructure/`. Its helpers and shared kit may not hand a foreign interior back out either:
 * a re-export would let a test reach it from a file this scan does not read.
 */
import { describe, expect, it } from "vitest";
import { INTERNAL_IMPORT, read, resolveImportTarget, tsFilesUnder } from "./helpers.js";

const FOREIGN_INTERIOR_FOLDERS = ["domain", "infrastructure"];

/** The context whose `domain/` or `infrastructure/` `target` sits in, or null. */
function interiorOwner(target: string): string | null {
  const match = /^src\/contexts\/([^/]+)\/([^/]+)\//.exec(target);
  return match !== null && FOREIGN_INTERIOR_FOLDERS.includes(match[2] ?? "")
    ? (match[1] ?? null)
    : null;
}

function foreignInteriorImports(file: string, source: string): string[] {
  const own = /^tests\/contexts\/([^/]+)\//.exec(file)?.[1];
  if (own === undefined) return [];
  return [...source.matchAll(INTERNAL_IMPORT)].flatMap((match) => {
    const specifier = match[1] ?? "";
    const owner = interiorOwner(resolveImportTarget(file, specifier));
    return owner !== null && owner !== own
      ? [`${file}: reaches the interior of ${owner}: ${specifier}`]
      : [];
  });
}

const INLINE_RE_EXPORT =
  /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s+["']([^"']+)["']/gm;
const BARE_RE_EXPORT = /^export\s+(?:type\s+)?\{([^}]*)\};?$/gm;
const NAMED_IMPORT =
  /^import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+["']([^"']+)["']/gm;

const reachesInterior = (target: string): boolean =>
  interiorOwner(target) !== null || /^tests\/contexts\/[^/]+\/testing\//.test(target);

const localNames = (list: string, keep: (part: string) => string): string[] =>
  list
    .split(",")
    .map((part) => keep(part.trim().replace(/^type\s+/, "")))
    .filter((name) => name !== "");

/** Re-exports of a context interior or a context kit from a helper or the shared kit: written
 * as `export ... from`, or as `export { name }` of a name imported from one. */
function launderedInteriors(file: string, source: string): string[] {
  if (!/^tests\/(?:helpers|shared)\//.test(file)) return [];
  const inline = [...source.matchAll(INLINE_RE_EXPORT)]
    .map((match) => match[1] ?? "")
    .filter(
      (specifier) =>
        specifier.startsWith(".") && reachesInterior(resolveImportTarget(file, specifier))
    );
  const imported = new Set(
    [...source.matchAll(NAMED_IMPORT)]
      .filter(
        (match) =>
          (match[3] ?? "").startsWith(".") &&
          reachesInterior(resolveImportTarget(file, match[3] ?? ""))
      )
      .flatMap((match) => [
        ...(match[1] === undefined ? [] : [match[1]]),
        ...localNames(match[2] ?? "", (part) => part.split(/\s+as\s+/).pop() ?? ""),
      ])
  );
  const bare = [...source.matchAll(BARE_RE_EXPORT)]
    .flatMap((match) => localNames(match[1] ?? "", (part) => part.split(/\s+as\s+/)[0] ?? ""))
    .filter((name) => imported.has(name));
  return [...inline, ...bare].map((what) => `${file}: re-exports a foreign interior: ${what}`);
}

describe("a test never reaches another context's domain or infrastructure", () => {
  it("holds across tests/contexts", () => {
    const files = tsFilesUnder("tests/contexts");
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap((file) => foreignInteriorImports(file, read(file)))).toEqual([]);
  });

  it("flags another context's domain and infrastructure", () => {
    const test = "tests/contexts/a/x/y.test.ts";
    const from = (folder: string) =>
      `import { f } from "../../../../src/contexts/b/${folder}/m.js";`;
    expect(foreignInteriorImports(test, from("domain"))).toHaveLength(1);
    expect(foreignInteriorImports(test, from("infrastructure"))).toHaveLength(1);
    expect(foreignInteriorImports(test, `import "@/contexts/b/domain/m.js";`)).toHaveLength(1);
  });

  it("clears the published surface, the shared source, the composition and its own interior", () => {
    const test = "tests/contexts/a/x/y.test.ts";
    const from = (path: string) => `import { f } from "../../../../src/${path}/m.js";`;
    expect(foreignInteriorImports(test, from("contexts/b/contract"))).toEqual([]);
    expect(foreignInteriorImports(test, from("contexts/b/application"))).toEqual([]);
    expect(foreignInteriorImports(test, from("shared/domain"))).toEqual([]);
    expect(foreignInteriorImports(test, from("composition"))).toEqual([]);
    expect(foreignInteriorImports(test, from("contexts/a/domain"))).toEqual([]);
  });
});

describe("a helper never hands a foreign interior back out", () => {
  it("holds across tests/helpers and tests/shared", () => {
    const files = [...tsFilesUnder("tests/helpers"), ...tsFilesUnder("tests/shared")];
    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap((file) => launderedInteriors(file, read(file)))).toEqual([]);
  });

  it("flags an inline and a bare re-export of an interior or a kit", () => {
    const helper = "tests/shared/testing/k.ts";
    const interior = "../../../src/contexts/b/domain/m.js";
    expect(launderedInteriors(helper, `export { f } from "${interior}";`)).toHaveLength(1);
    expect(
      launderedInteriors(helper, `export * from "../../contexts/b/testing/k.js";`)
    ).toHaveLength(1);
    expect(
      launderedInteriors(helper, `import { f } from "${interior}";\nexport { f };`)
    ).toHaveLength(1);
  });

  it("clears a re-export of a published surface and a plain use of an interior", () => {
    const helper = "tests/shared/testing/k.ts";
    expect(
      launderedInteriors(helper, `export { f } from "../../../src/contexts/b/contract/m.js";`)
    ).toEqual([]);
    expect(
      launderedInteriors(
        helper,
        `import { f } from "../../../src/contexts/b/domain/m.js";\nexport const g = f();`
      )
    ).toEqual([]);
  });
});
