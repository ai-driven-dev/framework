/**
 * A test of a context reaches another context's source through its `application/` or
 * `contract/` only, through `src/shared` and through `src/composition`: every other folder of a
 * foreign context (`domain/`, `infrastructure/`, `ports/`, any new one) is closed. Its helpers
 * and shared kit may not hand a foreign context's closed folder or kit back out either: a
 * re-export would let a test reach it from a file this scan does not read.
 *
 * Written limits, not caught here: a value alias (`import { X } from "<closed>"; export const H =
 * X`) hands the interior out without a re-export, and `vi.importActual("<closed>")` reaches it
 * without a static import. Neither occurs in the tree today.
 */
import { describe, expect, it } from "vitest";
import { INTERNAL_IMPORT, read, resolveImportTarget, tsFilesUnder } from "./helpers.js";

/** The only folders of a context another context's tests may reach (reference-context.md, "Ports
 * and contract"). */
const PUBLISHED_FOLDERS = ["application", "contract"];

/** The context whose closed folder `target` sits in, or null. */
function closedFolderOwner(target: string): string | null {
  const match = /^src\/contexts\/([^/]+)\/([^/]+)\//.exec(target);
  return match !== null && !PUBLISHED_FOLDERS.includes(match[2] ?? "") ? (match[1] ?? null) : null;
}

function foreignInteriorImports(file: string, source: string): string[] {
  const own = /^tests\/contexts\/([^/]+)\//.exec(file)?.[1];
  if (own === undefined) return [];
  return [...source.matchAll(INTERNAL_IMPORT)].flatMap((match) => {
    const specifier = match[1] ?? "";
    const owner = closedFolderOwner(resolveImportTarget(file, specifier));
    return owner !== null && owner !== own
      ? [`${file}: reaches a closed folder of ${owner}: ${specifier}`]
      : [];
  });
}

const INLINE_RE_EXPORT =
  /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s+["']([^"']+)["']/gm;
const NAMESPACE_IMPORT = /^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/gm;
const BARE_RE_EXPORT = /^export\s+(?:type\s+)?\{([^}]*)\};?$/gm;

const reachesClosed = (target: string): boolean =>
  closedFolderOwner(target) !== null || /^tests\/contexts\/[^/]+\/testing\//.test(target);

/** Re-exports of a closed folder or a context kit from a helper or the shared kit: written as
 * `export ... from`, or as `export { ns }` of a namespace imported from one. A named import
 * re-exported bare is biome's `noExportedImports`. */
function launderedInteriors(file: string, source: string): string[] {
  if (!/^tests\/(?:helpers|shared)\//.test(file)) return [];
  const inline = [...source.matchAll(INLINE_RE_EXPORT)]
    .map((match) => match[1] ?? "")
    .filter(
      (specifier) =>
        specifier.startsWith(".") && reachesClosed(resolveImportTarget(file, specifier))
    );
  const namespaces = new Set(
    [...source.matchAll(NAMESPACE_IMPORT)]
      .filter(
        (match) =>
          (match[2] ?? "").startsWith(".") &&
          reachesClosed(resolveImportTarget(file, match[2] ?? ""))
      )
      .map((match) => match[1] ?? "")
  );
  const bare = [...source.matchAll(BARE_RE_EXPORT)]
    .flatMap((match) =>
      (match[1] ?? "").split(",").map((part) => (part.trim().split(/\s+as\s+/)[0] ?? "").trim())
    )
    .filter((name) => namespaces.has(name));
  return [...inline, ...bare].map((what) => `${file}: re-exports a closed folder: ${what}`);
}

describe("a test never reaches another context's domain or infrastructure", () => {
  it("holds across tests/contexts", () => {
    const files = tsFilesUnder("tests/contexts");
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap((file) => foreignInteriorImports(file, read(file)))).toEqual([]);
  });

  it("flags every folder of another context but its application and contract", () => {
    const test = "tests/contexts/a/x/y.test.ts";
    const from = (folder: string) =>
      `import { f } from "../../../../src/contexts/b/${folder}/m.js";`;
    expect(foreignInteriorImports(test, from("domain"))).toHaveLength(1);
    expect(foreignInteriorImports(test, from("infrastructure"))).toHaveLength(1);
    expect(foreignInteriorImports(test, from("ports"))).toHaveLength(1);
    expect(foreignInteriorImports(test, from("domain/sub"))).toHaveLength(1);
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
    expect(foreignInteriorImports(test, from("contexts/a/ports"))).toEqual([]);
    expect(foreignInteriorImports(test, from("contexts/b/application/sub"))).toEqual([]);
  });
});

describe("a helper never hands a foreign interior back out", () => {
  it("holds across tests/helpers and tests/shared", () => {
    const files = [...tsFilesUnder("tests/helpers"), ...tsFilesUnder("tests/shared")];
    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap((file) => launderedInteriors(file, read(file)))).toEqual([]);
  });

  it("flags an inline and a namespace re-export of a closed folder or a kit", () => {
    const helper = "tests/shared/testing/k.ts";
    const interior = "../../../src/contexts/b/domain/m.js";
    expect(launderedInteriors(helper, `export { f } from "${interior}";`)).toHaveLength(1);
    expect(
      launderedInteriors(helper, `export * from "../../contexts/b/testing/k.js";`)
    ).toHaveLength(1);
    expect(
      launderedInteriors(helper, `import * as h from "${interior}";\nexport { h };`)
    ).toHaveLength(1);
    expect(
      launderedInteriors(helper, `export { f } from "../../../src/contexts/b/ports/m.js";`)
    ).toHaveLength(1);
  });

  it("clears a re-export of a published surface and a plain use of a closed folder", () => {
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
