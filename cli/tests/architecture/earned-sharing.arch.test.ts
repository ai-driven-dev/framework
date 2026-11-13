/**
 * A module is shared only when it has callers in at least two functional areas. One caller
 * means the code belongs to that caller: move it down, do not promote it. Under `src/shared/`
 * the callers counted are contexts: a module only one context imports belongs to that context.
 */
import { describe, expect, it } from "vitest";
import {
  contextOf,
  expectRatchet,
  importersByFile,
  isContext,
  read,
  sourceFiles,
} from "./helpers.js";

/** Files that fail the rule today. This list may only shrink. */
const BASELINE: string[] = [];

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

/** The contexts that import `file`. Presentation and composition consume but are no context. */
function contextsImporting(file: string, importers: Map<string, Set<string>>): Set<string> {
  const contexts = new Set<string>();
  for (const importer of importers.get(file) ?? []) {
    const context = contextOf(importer);
    if (isContext(context)) contexts.add(context);
  }
  return contexts;
}

/** The interface names a shared port file declares. */
function declaredBy(portText: string): string[] {
  return [...portText.matchAll(/export (?:interface|type) (\w+)/g)].map((m) => m[1] as string);
}

/**
 * Every file under `src/shared/` that is not earned. Domain and ports are earned by two
 * contexts. An infrastructure file is earned when it implements an earned port, when an earned
 * infrastructure file imports it, or when two compositions wire it: no context reaches it.
 */
function unearnedShared(
  files: readonly string[],
  importers: Map<string, Set<string>>,
  textOf: (file: string) => string
): string[] {
  const shared = files.filter((file) => file.startsWith("src/shared/"));
  const earned = new Set(
    shared.filter(
      (file) =>
        !file.startsWith("src/shared/infrastructure/") &&
        contextsImporting(file, importers).size >= 2
    )
  );
  const infrastructure = shared.filter((file) => file.startsWith("src/shared/infrastructure/"));
  const implemented = (file: string): boolean => {
    const clause = /implements ([^{]+)\{/.exec(textOf(file))?.[1] ?? "";
    return [...earned].some(
      (port) =>
        port.startsWith("src/shared/ports/") &&
        declaredBy(textOf(port)).some((name) => new RegExp(`\\b${name}\\b`).test(clause))
    );
  };
  const wiredTwice = (file: string): boolean =>
    [...(importers.get(file) ?? [])].filter((i) => i.startsWith("src/composition/")).length >= 2;
  const reachedByEarned = (file: string): boolean =>
    [...(importers.get(file) ?? [])].some((i) => earned.has(i));

  for (let grew = true; grew; ) {
    grew = false;
    for (const file of infrastructure) {
      if (earned.has(file)) continue;
      if (implemented(file) || wiredTwice(file) || reachedByEarned(file)) {
        earned.add(file);
        grew = true;
      }
    }
  }
  return shared.filter((file) => !earned.has(file));
}

describe("shared modules are earned", () => {
  it("every file under src/shared/ is imported by at least two contexts", () => {
    const files = sourceFiles();
    expect(
      files.filter((file) => file.startsWith("src/shared/")).length,
      "no shared file found — the scope of this rule is stale"
    ).toBeGreaterThan(0);

    expect(
      unearnedShared(files, importersByFile(), read),
      "a shared file earned by nothing: move it into the one context that uses it"
    ).toEqual([]);
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

  it("flags a shared file one context imports and clears one an earned adapter or two compositions reach", () => {
    const text: Record<string, string> = {
      "src/shared/ports/reader.ts": "export interface Reader {}",
      "src/shared/infrastructure/adapter.ts": "class A implements Reader {}",
      "src/shared/infrastructure/helper.ts": "",
      "src/shared/infrastructure/wired.ts": "",
      "src/shared/infrastructure/lonely.ts": "class B implements Other {}",
    };
    const from = (...files: string[]): Set<string> => new Set(files);
    const twoContexts = from(
      "src/contexts/framework/domain/a.ts",
      "src/contexts/tools/domain/b.ts"
    );
    const importers = new Map([
      [
        "src/shared/domain/lonely.ts",
        from(
          "src/contexts/framework/domain/a.ts",
          "src/contexts/framework/application/b.ts",
          "src/presentation/commands/doctor.ts"
        ),
      ],
      ["src/shared/domain/earned.ts", twoContexts],
      ["src/shared/ports/reader.ts", twoContexts],
      ["src/shared/infrastructure/helper.ts", from("src/shared/infrastructure/adapter.ts")],
      [
        "src/shared/infrastructure/wired.ts",
        from("src/composition/framework.ts", "src/composition/tools.ts"),
      ],
      ["src/shared/infrastructure/lonely.ts", from("src/composition/framework.ts")],
    ]);
    const files = [...new Set([...importers.keys(), ...Object.keys(text)])];

    expect(unearnedShared(files, importers, (f) => text[f] ?? "")).toEqual([
      "src/shared/domain/lonely.ts",
      "src/shared/infrastructure/lonely.ts",
    ]);
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
