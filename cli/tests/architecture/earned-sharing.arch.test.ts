/**
 * A module is shared only when it has callers in at least two functional areas. One caller
 * means the code belongs to that caller: move it down, do not promote it. Under `src/shared/`
 * the callers counted are contexts: a module only one context imports belongs to that context.
 */
import { describe, expect, it } from "vitest";
import { contextNames, expectRatchet, importersByFile, sourceFiles } from "./helpers.js";

/** Files that fail the rule today. This list may only shrink. */
const BASELINE: string[] = [];

/**
 * Files under `src/shared/` that one context alone uses today. Each stays until the reason
 * beside it goes; the list may only shrink.
 */
const SHARED_BASELINE: string[] = [
  // Vanishes when the file adapter moves into framework, which hands the merger on.
  "src/shared/ports/file-merger.ts",
  // Vanish when the adapter moves into the one context its composition wires it for.
  "src/shared/infrastructure/current-version-adapter.ts",
  "src/shared/infrastructure/environment-adapter.ts",
  "src/shared/infrastructure/file-adapter.ts",
  "src/shared/infrastructure/github-adapter.ts",
];

/** The functional area a file belongs to. Two callers in one area are still one area. */
function areaOf(file: string): string {
  // The composition root constructs every use case by definition: counting it as an area
  // would let any module satisfy the rule by being wired rather than needed twice.
  if (file.startsWith("src/composition/")) {
    return "composition-root";
  }
  // A context's application layer is where the areas live.
  const contextArea = /^src\/contexts\/[^/]+\/application\/([^/]+)\//.exec(file);
  if (contextArea) return `use-case:${contextArea[1]}`;
  const contextRoot = /^src\/contexts\/([^/]+)\/application\/[^/]+\.ts$/.exec(file);
  if (contextRoot) return `use-case:${contextRoot[1]}-root`;
  const contextInner = /^src\/contexts\/([^/]+)\/(domain|infrastructure)\//.exec(file);
  if (contextInner) return `${contextInner[2]}:${contextInner[1]}`;
  if (file.startsWith("src/presentation/commands/")) return "commands";
  if (file.startsWith("src/presentation/prompts/")) return "prompts";
  if (file.startsWith("src/presentation/")) return "presentation";
  if (file.startsWith("src/shared/")) return "shared";
  return "other";
}

const NON_AREAS = new Set(["use-case:shared", "composition-root"]);

/**
 * Only a file sitting directly inside a `shared/` directory is offered to callers; one nested
 * further under a shared module is that module's own private step.
 */
function underSharedDirectory(file: string): boolean {
  return /\/shared\/[^/]+$/.test(file);
}

function unearned(files: readonly string[], importers: Map<string, Set<string>>): string[] {
  return files.filter(underSharedDirectory).filter((file) => {
    const areas = new Set(
      [...(importers.get(file) ?? [])].map(areaOf).filter((area) => !NON_AREAS.has(area))
    );
    return areas.size < 2;
  });
}

/**
 * The contexts that import `file`. A composition file counts as the context it wires: an
 * adapter is reached through its composition, never from inside a context.
 */
function contextsImporting(file: string, importers: Map<string, Set<string>>): Set<string> {
  const contexts = new Set<string>();
  const wiresContexts = file.startsWith("src/shared/infrastructure/");
  for (const importer of importers.get(file) ?? []) {
    const inContext = /^src\/contexts\/([^/]+)\//.exec(importer)?.[1];
    const wired = wiresContexts ? /^src\/composition\/([^/]+)\.ts$/.exec(importer)?.[1] : undefined;
    if (inContext !== undefined) contexts.add(inContext);
    else if (wired !== undefined && contextNames().includes(wired)) contexts.add(wired);
  }
  return contexts;
}

/** Every file under `src/shared/` that fewer than two contexts import. */
function unearnedShared(files: readonly string[], importers: Map<string, Set<string>>): string[] {
  return files
    .filter((file) => file.startsWith("src/shared/"))
    .filter((file) => contextsImporting(file, importers).size < 2);
}

describe("shared modules are earned", () => {
  it("every file under src/shared/ is imported by at least two contexts", () => {
    const files = sourceFiles();
    expect(
      files.filter((file) => file.startsWith("src/shared/")).length,
      "no shared file found — the scope of this rule is stale"
    ).toBeGreaterThan(0);

    const { added, fixed } = expectRatchet(
      unearnedShared(files, importersByFile()),
      SHARED_BASELINE
    );
    expect(added, "a shared file only one context imports: move it into that context").toEqual([]);
    expect(fixed, "fixed — remove these from SHARED_BASELINE").toEqual([]);
  });

  it("every shared module has callers in at least two areas", () => {
    const files = sourceFiles();
    // A rule that selects nothing passes forever, and this one selects a single directory.
    expect(
      files.filter(underSharedDirectory).length,
      "no shared module found — the scope of this rule is stale"
    ).toBeGreaterThan(0);
    const violations = unearned(files, importersByFile());

    const { added, fixed } = expectRatchet(violations, BASELINE);
    expect(added, "new shared module with fewer than two calling areas").toEqual([]);
    expect(fixed, "fixed — remove these from BASELINE").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("flags a shared module called from one area and clears one called from two", () => {
    const lonely = "src/contexts/framework/application/shared/lonely.ts";
    const earned = "src/contexts/framework/application/shared/earned.ts";
    const importers = new Map([
      [lonely, new Set(["src/contexts/framework/application/doctor/a.ts"])],
      [
        earned,
        new Set([
          "src/contexts/framework/application/doctor/a.ts",
          "src/presentation/commands/doctor.ts",
        ]),
      ],
    ]);

    expect(unearned([lonely, earned], importers)).toEqual([lonely]);
  });

  it("flags a shared file one context imports, however many of its files do", () => {
    const lonely = "src/shared/domain/lonely.ts";
    const earned = "src/shared/domain/earned.ts";
    const adapter = "src/shared/infrastructure/adapter.ts";
    const importers = new Map([
      [
        lonely,
        new Set([
          "src/contexts/framework/application/a.ts",
          "src/contexts/framework/domain/b.ts",
          "src/presentation/commands/doctor.ts",
          "src/composition/framework.ts",
        ]),
      ],
      [earned, new Set(["src/contexts/framework/domain/a.ts", "src/contexts/tools/domain/b.ts"])],
      [adapter, new Set(["src/composition/framework.ts", "src/composition/tools.ts"])],
    ]);

    expect(unearnedShared([lonely, earned, adapter, "src/cli.ts"], importers)).toEqual([lonely]);
  });

  it("names an area for every place a caller lives, so two callers are not both 'other'", () => {
    expect(areaOf("src/contexts/framework/application/doctor/a.ts")).toBe("use-case:doctor");
    expect(areaOf("src/contexts/framework/application/setup-use-case.ts")).toBe(
      "use-case:framework-root"
    );
    expect(areaOf("src/contexts/tools/domain/registry.ts")).toBe("domain:tools");
    expect(areaOf("src/contexts/tools/infrastructure/a.ts")).toBe("infrastructure:tools");
    expect(areaOf("src/presentation/commands/doctor.ts")).toBe("commands");
    expect(areaOf("src/presentation/display/a.ts")).toBe("presentation");
    expect(areaOf("src/shared/domain/tool.ts")).toBe("shared");
    expect(areaOf("src/composition/auth.ts"), "the composition of a migrated context").toBe(
      "composition-root"
    );
  });
});
