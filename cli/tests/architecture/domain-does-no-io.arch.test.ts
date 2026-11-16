/**
 * A context's domain does no I/O (`0-hexagonal.md`), and the file ports are how I/O reaches
 * it: a domain file that names `shared/ports/file-reader` or `file-writer` is handed the disk.
 * `domain/ports/` declares interfaces and may name them.
 *
 * Measured: biome's `noRestrictedImports` refuses `import type` and `import { type }`, but not
 * an inline `import("…").FileReader`, and it replaces a rule's options with the last matching
 * override, so the one per-context domain override cannot also carry a baseline. The rule
 * lives here, reading every import form `INTERNAL_IMPORT` reads.
 *
 * The same blind spot hides an inline `import("node:fs")` type: only `node:path` and
 * `node:crypto` are pure, so any other builtin named that way in a domain folder is I/O.
 */
import { describe, expect, it } from "vitest";
import {
  expectRatchet,
  INTERNAL_IMPORT,
  read,
  resolveImportTarget,
  sourceFiles,
} from "./helpers.js";

const FILE_PORTS = new Set(["src/shared/ports/file-reader.ts", "src/shared/ports/file-writer.ts"]);

const DOMAIN = /^src\/contexts\/[^/]+\/domain\//;
const ANY_DOMAIN = /^src\/(?:contexts\/[^/]+|shared)\/domain\//;
const PURE_BUILTINS: ReadonlySet<string> = new Set(["path", "crypto"]);
const INLINE_BUILTIN_IMPORT = /\bimport\s*\(\s*["']node:([a-z_/]+)["']\s*\)/g;
const DOMAIN_PORTS = /^src\/contexts\/[^/]+\/domain\/ports\//;

/**
 * Domain files that import a file port today, each with the number of such imports. The list
 * may only shrink: a file that stops importing one leaves it, a new import fails.
 */
const BASELINE: readonly { readonly file: string; readonly imports: number; reason: string }[] = [];

/** One `<file> (<imports>)` entry per domain file naming a file port, ports excepted. */
function fileIoImports(bodies: ReadonlyMap<string, string>): string[] {
  const found: string[] = [];
  for (const [file, body] of bodies) {
    if (!DOMAIN.test(file) || DOMAIN_PORTS.test(file)) continue;
    let imports = 0;
    for (const match of body.matchAll(INTERNAL_IMPORT)) {
      if (FILE_PORTS.has(resolveImportTarget(file, match[1] as string))) imports += 1;
    }
    if (imports > 0) found.push(`${file} (${imports})`);
  }
  return found.sort();
}

/** One `<file> (node:<builtin>)` entry per inline builtin import that is not pure. */
function impureInlineBuiltins(bodies: ReadonlyMap<string, string>): string[] {
  const found: string[] = [];
  for (const [file, body] of bodies) {
    if (!ANY_DOMAIN.test(file)) continue;
    for (const match of body.matchAll(INLINE_BUILTIN_IMPORT)) {
      const builtin = match[1] as string;
      if (!PURE_BUILTINS.has(builtin)) found.push(`${file} (node:${builtin})`);
    }
  }
  return found.sort();
}

describe("a context's domain does no I/O", () => {
  it("no domain file outside domain/ports/ imports a file port, beyond the baseline", () => {
    const bodies = new Map(sourceFiles().map((file) => [file, read(file)]));

    const { added, fixed } = expectRatchet(
      fileIoImports(bodies),
      BASELINE.map((entry) => `${entry.file} (${entry.imports})`)
    );

    expect(
      added,
      "a domain file imports shared/ports/file-reader or file-writer — take the data, or move the I/O to infrastructure"
    ).toEqual([]);
    expect(fixed, "fixed or changed — update BASELINE").toEqual([]);
  });

  it("no domain file names an inline import of a Node builtin other than path and crypto", () => {
    const bodies = new Map(sourceFiles().map((file) => [file, read(file)]));

    expect(
      impureInlineBuiltins(bodies),
      'an inline import("node:...") in domain/ is I/O biome does not see: take a port'
    ).toEqual([]);
  });

  it("finds domain files to check, so the rule cannot pass by selecting nothing", () => {
    expect(
      sourceFiles().filter((file) => DOMAIN.test(file)).length,
      "no domain file found — the scope of this rule is stale"
    ).toBeGreaterThan(50);
  });
});

describe("the guard itself", () => {
  const writer = 'import type { FileWriter } from "../../../shared/ports/file-writer.js";';

  it("names a domain file importing file-writer, whatever the import form", () => {
    const bodies = new Map([
      ["src/contexts/framework/domain/a.ts", writer],
      [
        "src/contexts/framework/domain/b.ts",
        'import { type FileReader } from "../../../shared/ports/file-reader.js";',
      ],
      [
        "src/contexts/framework/domain/nested/c.ts",
        'export type R = import("../../../../shared/ports/file-reader.js").FileReader;',
      ],
    ]);

    expect(fileIoImports(bodies)).toEqual([
      "src/contexts/framework/domain/a.ts (1)",
      "src/contexts/framework/domain/b.ts (1)",
      "src/contexts/framework/domain/nested/c.ts (1)",
    ]);
  });

  it("leaves domain/ports/, application and infrastructure alone", () => {
    const bodies = new Map([
      ["src/contexts/framework/domain/ports/store.ts", writer.replace('"../', '"../../')],
      ["src/contexts/framework/application/a.ts", writer],
      ["src/contexts/framework/infrastructure/a.ts", writer],
    ]);

    expect(fileIoImports(bodies)).toEqual([]);
  });

  it("counts each import, so a second port import on a baselined file is new", () => {
    const bodies = new Map([
      [
        "src/contexts/tools/domain/x.ts",
        `${writer}\nimport type { FileReader } from "../../../shared/ports/file-reader.js";`,
      ],
    ]);

    expect(fileIoImports(bodies)).toEqual(["src/contexts/tools/domain/x.ts (2)"]);
  });
});

describe("the inline builtin guard itself", () => {
  it("names an impure builtin in either kind of domain folder, and spares the pure ones", () => {
    const bodies = new Map([
      ["src/contexts/tools/domain/a.ts", 'type A = import("node:fs").Stats;'],
      ["src/shared/domain/b.ts", "type B = import( 'node:child_process' ).ChildProcess;"],
      ["src/contexts/tools/domain/c.ts", 'type C = import("node:path").ParsedPath;'],
      ["src/contexts/tools/domain/d.ts", 'type D = import("node:crypto").Hash;'],
      ["src/contexts/tools/infrastructure/e.ts", 'type E = import("node:fs").Stats;'],
    ]);

    expect(impureInlineBuiltins(bodies)).toEqual([
      "src/contexts/tools/domain/a.ts (node:fs)",
      "src/shared/domain/b.ts (node:child_process)",
    ]);
  });
});
