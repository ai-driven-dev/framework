/**
 * A context's domain does no I/O (`0-hexagonal.md`), and the file ports are how I/O reaches
 * it: a domain file that names `kernel/ports/file-reader` or `file-writer` is handed the disk.
 * `domain/ports/` declares interfaces and may name them.
 *
 * Measured: biome's `noRestrictedImports` refuses `import type` and `import { type }`, but not
 * an inline `import("…").FileReader`, and it replaces a rule's options with the last matching
 * override, so the one per-context domain override cannot also carry a baseline. The rule
 * lives here, reading every import form `INTERNAL_IMPORT` reads.
 */
import { describe, expect, it } from "vitest";
import {
  expectRatchet,
  INTERNAL_IMPORT,
  read,
  resolveImportTarget,
  sourceFiles,
} from "./helpers.js";

const FILE_PORTS = new Set(["src/kernel/ports/file-reader.ts", "src/kernel/ports/file-writer.ts"]);

const DOMAIN = /^src\/contexts\/[^/]+\/domain\//;
const DOMAIN_PORTS = /^src\/contexts\/[^/]+\/domain\/ports\//;

/**
 * Domain files that import a file port today, each with the number of such imports. The list
 * may only shrink: a file that stops importing one leaves it, a new import fails.
 */
const BASELINE: readonly { readonly file: string; readonly imports: number; reason: string }[] = [
  {
    file: "src/contexts/tools/domain/build-contract.ts",
    imports: 2,
    reason:
      "the build contract hands each profile `fs` for its marketplace catalog and config emit",
  },
  {
    file: "src/contexts/tools/domain/capabilities/mcp-capability.ts",
    imports: 1,
    reason: "`resolveOutput` probes the disk for the tool's MCP config path",
  },
  {
    file: "src/contexts/tools/domain/marketplace-catalog.ts",
    imports: 2,
    reason: "the Claude-style catalog reads each plugin manifest and writes the entry",
  },
  {
    file: "src/contexts/tools/domain/profiles/codex/build.ts",
    imports: 2,
    reason: "the flat build reads the plugin's MCP file and merges `.codex/config.toml`",
  },
  {
    file: "src/contexts/tools/domain/profiles/kilo/build.ts",
    imports: 2,
    reason: "the flat build reads the plugin's MCP file and merges the Kilo config",
  },
  {
    file: "src/contexts/tools/domain/profiles/kilo/kilo-paths.ts",
    imports: 1,
    reason: "`resolveKiloConfigPath` probes which config file the project already has",
  },
  {
    file: "src/contexts/tools/domain/profiles/opencode/build.ts",
    imports: 2,
    reason:
      "the flat build reads the plugin's MCP file, merges opencode.json, writes the bridge events",
  },
  {
    file: "src/contexts/tools/domain/registry.ts",
    imports: 1,
    reason: "the registry lists and reads a tool's files from disk",
  },
];

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

describe("a context's domain does no I/O", () => {
  it("no domain file outside domain/ports/ imports a file port, beyond the baseline", () => {
    const bodies = new Map(sourceFiles().map((file) => [file, read(file)]));

    const { added, fixed } = expectRatchet(
      fileIoImports(bodies),
      BASELINE.map((entry) => `${entry.file} (${entry.imports})`)
    );

    expect(
      added,
      "a domain file imports kernel/ports/file-reader or file-writer — take the data, or move the I/O to infrastructure"
    ).toEqual([]);
    expect(fixed, "fixed or changed — update BASELINE").toEqual([]);
  });

  it("finds domain files to check, so the rule cannot pass by selecting nothing", () => {
    expect(
      sourceFiles().filter((file) => DOMAIN.test(file)).length,
      "no domain file found — the scope of this rule is stale"
    ).toBeGreaterThan(50);
  });
});

describe("the guard itself", () => {
  const writer = 'import type { FileWriter } from "../../../kernel/ports/file-writer.js";';

  it("names a domain file importing file-writer, whatever the import form", () => {
    const bodies = new Map([
      ["src/contexts/framework/domain/a.ts", writer],
      [
        "src/contexts/framework/domain/b.ts",
        'import { type FileReader } from "../../../kernel/ports/file-reader.js";',
      ],
      [
        "src/contexts/framework/domain/nested/c.ts",
        'export type R = import("../../../../kernel/ports/file-reader.js").FileReader;',
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
        `${writer}\nimport type { FileReader } from "../../../kernel/ports/file-reader.js";`,
      ],
    ]);

    expect(fileIoImports(bodies)).toEqual(["src/contexts/tools/domain/x.ts (2)"]);
  });
});
