/**
 * A module is shared only when it has callers in at least two functional areas. One caller
 * means the code belongs to that caller: move it down, do not promote it. Under `src/shared/`
 * the callers counted are contexts: a module only one context imports belongs to that context.
 */
import { describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.builder.js";
import { contextOf, importersByFile, isContext, read, sourceFiles } from "./source-graph.js";

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
  const scenario = /^src\/orchestration\/([^/]+)\//.exec(file);
  if (scenario) return `scenario:${scenario[1]}`;
  if (file.startsWith("src/presentation/controllers/")) return "controllers";
  if (file.startsWith("src/presentation/")) return "presentation";
  if (file.startsWith("src/shared/")) return "shared";
  return "other";
}

const NON_AREAS = new Set(["use-case:shared", "scenario:shared", "composition-root"]);

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

/**
 * A declaration file with no top-level import or export is ambient: it types what the build
 * inlines, nothing imports it, so it has no callers to count. Told by its content, not its name.
 */
function isAmbientDeclaration(file: string, textOf: (file: string) => string): boolean {
  return file.endsWith(".d.ts") && !/^(?:import|export)\b/m.test(textOf(file));
}

/** The interface names a shared port file declares. */
function declaredBy(portText: string): string[] {
  return [...portText.matchAll(/export (?:interface|type) (\w+)/g)].map((m) => present(m[1]));
}

/** What the search for earned shared files holds: who imports each file, which files are earned so
 * far, and the text of a file. */
interface Sharing {
  readonly importers: Map<string, Set<string>>;
  readonly earned: Set<string>;
  readonly textOf: (file: string) => string;
}

const importersOf = (file: string, { importers }: Sharing): string[] => [
  ...(importers.get(file) ?? []),
];

const readByEarned =
  (prefix: string) =>
  (file: string, sharing: Sharing): boolean =>
    importersOf(file, sharing).some((i) => i.startsWith(prefix) && sharing.earned.has(i));

const readByEarnedAdapter = readByEarned("src/shared/infrastructure/");
const readByEarnedPort = readByEarned("src/shared/ports/");

const reachedByEarned = (file: string, sharing: Sharing): boolean =>
  importersOf(file, sharing).some((i) => sharing.earned.has(i));

const wiredTwice = (file: string, sharing: Sharing): boolean =>
  importersOf(file, sharing).filter((i) => i.startsWith("src/composition/")).length >= 2;

function implemented(file: string, sharing: Sharing): boolean {
  const clause = /implements ([^{]+)\{/.exec(sharing.textOf(file))?.[1] ?? "";
  return [...sharing.earned].some(
    (port) =>
      port.startsWith("src/shared/ports/") &&
      declaredBy(sharing.textOf(port)).some((name) => new RegExp(`\\b${name}\\b`).test(clause))
  );
}

const earnedInfrastructure = (file: string, sharing: Sharing): boolean =>
  implemented(file, sharing) || wiredTwice(file, sharing) || reachedByEarned(file, sharing);

interface Candidates {
  readonly files: readonly string[];
  readonly qualifies: (file: string, sharing: Sharing) => boolean;
}

/** Earns the candidates that qualify until none more does: one earned file can earn the next. */
function growEarned(groups: readonly Candidates[], sharing: Sharing): void {
  const joining = (): string[] =>
    groups.flatMap(({ files, qualifies }) =>
      files.filter((file) => !sharing.earned.has(file) && qualifies(file, sharing))
    );
  for (let next = joining(); next.length > 0; next = joining()) {
    for (const file of next) sharing.earned.add(file);
  }
}

/**
 * Every file under `src/shared/` that is not earned. Domain and ports are earned by two
 * contexts. An infrastructure file is earned when it implements an earned port, when an earned
 * infrastructure file imports it, or when two compositions wire it: no context reaches it. A
 * port is also earned when an earned infrastructure file reads it: that adapter is the second
 * caller its contexts no longer are.
 */
function unearnedShared(
  files: readonly string[],
  importers: Map<string, Set<string>>,
  textOf: (file: string) => string
): string[] {
  const shared = files.filter(
    (file) => file.startsWith("src/shared/") && !isAmbientDeclaration(file, textOf)
  );
  const inside = (prefix: string): string[] => shared.filter((file) => file.startsWith(prefix));
  const earned = new Set(
    shared.filter(
      (file) =>
        !file.startsWith("src/shared/infrastructure/") &&
        contextsImporting(file, importers).size >= 2
    )
  );
  growEarned(
    [
      { files: inside("src/shared/domain/"), qualifies: readByEarnedPort },
      { files: inside("src/shared/ports/"), qualifies: readByEarnedAdapter },
      { files: inside("src/shared/infrastructure/"), qualifies: earnedInfrastructure },
    ],
    { importers, earned, textOf }
  );
  return shared.filter((file) => !earned.has(file));
}

describe("shared modules are earned", () => {
  it("every file under src/shared/ is imported by at least two contexts", () => {
    const files = sourceFiles();
    expect(
      files.filter((file) => file.startsWith("src/shared/")).length,
      "no shared file found - the scope of this rule is stale"
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
      "no shared module found - the scope of this rule is stale"
    ).toBeGreaterThan(0);
    const violations = unearned(files, importersByFile());

    expect(violations, "a shared module with fewer than two calling areas").toEqual([]);
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
          "src/presentation/controllers/doctor/doctor.controller.ts",
        ]),
      ],
    ]);

    expect(unearned([lonely, earned], importers)).toEqual([lonely]);
  });

  it("does not count the shared folder of the orchestration as an area", () => {
    const leaf = "src/orchestration/shared/b.ts";
    const importers = new Map([
      [leaf, new Set(["src/orchestration/shared/a.ts", "src/orchestration/setup/x.ts"])],
    ]);

    expect(unearned([leaf], importers)).toEqual([leaf]);
  });

  it("flags a shared file one context imports and clears one an earned adapter or two compositions reach", () => {
    const [A, B] = ["src/contexts/framework/domain/x.ts", "src/contexts/tools/domain/x.ts"];
    const [C1, C2] = ["src/composition/container.ts", "src/composition/contexts/tools.ts"];
    const port = "src/shared/ports/port.ts";
    const adapter = "src/shared/infrastructure/adapter.ts";
    const leaf = "src/shared/infrastructure/leaf.ts";
    const wired = "src/shared/infrastructure/wired.ts";
    const text: Record<string, string> = {
      [port]: "export interface Reader {}",
      [adapter]: "class A implements Reader {}",
    };
    const importers = new Map([
      [
        "src/shared/domain/lonely.ts",
        new Set([A, "src/presentation/controllers/doctor/doctor.controller.ts"]),
      ],
      ["src/shared/domain/earned.ts", new Set([A, B])],
      [port, new Set([A, B])],
      [leaf, new Set([adapter])],
      [wired, new Set([C1, C2])],
      ["src/shared/infrastructure/lonely.ts", new Set([C1])],
    ]);
    const files = [...new Set([...importers.keys(), adapter])];

    expect(unearnedShared(files, importers, (f) => text[f] ?? "")).toEqual([
      "src/shared/domain/lonely.ts",
      "src/shared/infrastructure/lonely.ts",
    ]);
  });

  it("clears a port one context imports when an earned adapter in shared infrastructure reads it", () => {
    const A = "src/contexts/framework/domain/x.ts";
    const [C1, C2] = ["src/composition/container.ts", "src/composition/contexts/tools.ts"];
    const read = "src/shared/ports/read.ts";
    const lonely = "src/shared/ports/lonely.ts";
    const adapter = "src/shared/infrastructure/adapter.ts";
    const importers = new Map([
      [read, new Set([A, adapter])],
      [lonely, new Set([A, C1])],
      [adapter, new Set([C1, C2])],
    ]);

    expect(unearnedShared([read, lonely, adapter], importers, () => "")).toEqual([lonely]);
  });

  it("clears a domain type one context imports when an earned port in shared declares it in its signature", () => {
    const [A, B] = ["src/contexts/framework/domain/x.ts", "src/contexts/tools/domain/x.ts"];
    const port = "src/shared/ports/port.ts";
    const read = "src/shared/domain/read.ts";
    const lonely = "src/shared/domain/lonely.ts";
    const importers = new Map([
      [port, new Set([A, B])],
      [read, new Set([A, port])],
      [lonely, new Set([A])],
    ]);

    expect(unearnedShared([port, read, lonely], importers, () => "")).toEqual([lonely]);
  });

  it("clears an ambient declaration file nothing imports and flags a declaration module nobody imports", () => {
    const ambient = "src/shared/infrastructure/text-assets.d.ts";
    const module = "src/shared/infrastructure/types.d.ts";
    const text: Record<string, string> = {
      [ambient]: 'declare module "*.md" {\n  const content: string;\n  export default content;\n}',
      [module]: "export interface Lonely {}",
    };

    expect(unearnedShared([ambient, module], new Map(), (f) => text[f] ?? "")).toEqual([module]);
  });

  it("names an area for every place a caller lives, so two callers are not both 'other'", () => {
    expect(areaOf("src/contexts/framework/application/doctor/a.ts")).toBe("use-case:doctor");
    expect(areaOf("src/contexts/framework/application/setup-use-case.ts")).toBe(
      "use-case:framework-root"
    );
    expect(areaOf("src/contexts/tools/domain/registry.ts")).toBe("domain:tools");
    expect(areaOf("src/contexts/tools/infrastructure/a.ts")).toBe("infrastructure:tools");
    expect(areaOf("src/orchestration/setup/a.ts"), "one area per scenario").toBe("scenario:setup");
    expect(areaOf("src/presentation/controllers/doctor/doctor.controller.ts")).toBe("controllers");
    expect(areaOf("src/presentation/presenters/a.presenter.ts")).toBe("presentation");
    expect(areaOf("src/shared/domain/tool.ts")).toBe("shared");
    expect(
      areaOf("src/composition/contexts/auth.ts"),
      "the composition of a migrated context"
    ).toBe("composition-root");
  });
});
