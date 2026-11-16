/**
 * A constructor listing many collaborators is the signal that an orchestration reaches
 * inside the areas it crosses instead of asking their entry points.
 */
import { describe, expect, it } from "vitest";
import { expectRatchet, read, sourceFiles } from "./helpers.js";
import { closingBracket, codeOnly, topLevelPieces } from "./source-shapes.js";

/** Above this, a command takes on more dependencies than it can answer for, injected or instantiated. */
const MAX_CONSTRUCTOR_DEPENDENCIES = 5;

/**
 * Orchestrators over the limit today, each with the count its reason was written around.
 * The list only shrinks, and a count is never raised: the exact counts make any growth of an
 * admitted orchestrator fail this test.
 */
const BASELINE: readonly { readonly path: string; readonly dependencies: number }[] = [
  // Five section generators reached inline through a switch on section name, plus the config
  // generator. It resolves by registering a generator per section type, not by dropping one.
  {
    path: "src/contexts/installation/application/restore/generate-tool-distribution.ts",
    dependencies: 9,
  },
  { path: "src/contexts/installation/application/restore/restore.ts", dependencies: 12 },
  {
    path: "src/contexts/installation/application/restore/restore-tool-files.ts",
    dependencies: 9,
  },
  {
    path: "src/contexts/installation/application/install/install-ide-tool.ts",
    dependencies: 6,
  },
  {
    path: "src/contexts/installation/application/plugin/update-plugin.ts",
    dependencies: 6,
  },
  {
    path: "src/contexts/installation/application/restore/restore-all-plugins.ts",
    dependencies: 6,
  },
  // Carries `clean`'s shared-source guard and the separate current-source witness so a
  // targeted remove cannot disable another project's plugin or a repointed catalogue.
];

function isUseCase(file: string): boolean {
  return /^src\/(?:contexts\/[^/]+\/application|orchestration)\//.test(file);
}

/** A command is named by its verb, so no suffix finds one: it is a class with a public `execute`. */
const COMMAND_CLASSES = new Set(
  sourceFiles()
    .filter((file) => isUseCase(file) && /^\s+(?:async )?execute\(/m.test(read(file)))
    .flatMap((file) =>
      [...read(file).matchAll(/export (?:abstract )?class (\w+)/g)].map((m) => m[1])
    )
);

/**
 * One per parameter, or per name a destructured parameter binds, whatever its modifiers or type,
 * for each constructor of the file: a file holding several classes answers for the widest.
 */
function parameterCount(source: string): number {
  const code = codeOnly(source);
  const counts = [...code.matchAll(/\bconstructor\s*\(/g)].map((open) => {
    const start = open.index + open[0].length - 1;
    return topLevelPieces(code.slice(start + 1, closingBracket(code, start))).reduce(
      (count, parameter) => {
        const bare = parameter.replace(/^(?:(?:public|private|protected|readonly)\s+)+/, "");
        return (
          count +
          (bare.startsWith("{") ? topLevelPieces(bare.slice(1, closingBracket(bare, 0))).length : 1)
        );
      },
      0
    );
  });
  return Math.max(0, ...counts);
}

/**
 * Every constructor parameter counts, required or optional, modified or not and whatever its
 * type is named, plus each `new X(...)` of a command class a method reaches for, deduped by
 * class name within each.
 */
function constructorDependencyCount(
  source: string,
  commands: ReadonlySet<string> = COMMAND_CLASSES
): number {
  const inlineNames = new Set(
    [...source.matchAll(/new (\w+)\(/g)].map((m) => m[1]).filter((name) => commands.has(name))
  );
  return parameterCount(source) + inlineNames.size;
}

function overLimit(source: string, commands?: ReadonlySet<string>): boolean {
  return constructorDependencyCount(source, commands) > MAX_CONSTRUCTOR_DEPENDENCIES;
}

describe("orchestrators depend on entry points, not on parts", () => {
  it(`no command takes more than ${MAX_CONSTRUCTOR_DEPENDENCIES} dependencies, injected or instantiated`, () => {
    const candidates = sourceFiles().filter(isUseCase);
    // A rule that selects nothing passes forever: this filter named a tree the files left.
    expect(candidates.length, "the rule selects no file — its scope is stale").toBeGreaterThan(20);
    const violations = candidates.filter((file) => overLimit(read(file)));

    const { added, fixed } = expectRatchet(
      violations,
      BASELINE.map((entry) => entry.path)
    );
    expect(added, "orchestrator reaching inside the areas it crosses").toEqual([]);
    expect(fixed, "fixed — remove these from BASELINE").toEqual([]);
  });

  it("holds each admitted orchestrator to the count its reason was written around", () => {
    const recorded = BASELINE.map(({ path, dependencies }) => `${path}: ${dependencies}`);
    const actual = BASELINE.map(({ path }) => `${path}: ${constructorDependencyCount(read(path))}`);

    expect(
      actual,
      "an admitted orchestrator took on another collaborator — fix the count and its reason"
    ).toEqual(recorded);
  });
});

describe("the guard itself", () => {
  it("flags a constructor past the limit and clears one sitting at the limit", () => {
    const over = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES + 1 }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
    ) {}`;
    const atLimit = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
    ) {}`;

    expect(overLimit(over)).toBe(true);
    expect(overLimit(atLimit)).toBe(false);
  });

  it("reads a context's commands and the orchestration as the files it holds", () => {
    expect(isUseCase("src/orchestration/setup/setup.ts")).toBe(true);
    expect(isUseCase("src/contexts/auth/domain/credential-record.ts")).toBe(false);
  });

  it("counts an optional constructor dependency, not just a required one", () => {
    const atLimit = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
    ) {}`;
    const withOptionalOverLimit = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
      private readonly extra?: FooUseCase
    ) {}`;

    expect(overLimit(atLimit)).toBe(false);
    expect(overLimit(withOptionalOverLimit)).toBe(true);
  });

  it("counts a use case instantiated inline in a method body, not just an injected one", () => {
    const atLimit = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
    ) {}
    method(): void { new Bar(this.a0).execute(); }`;

    expect(overLimit(atLimit, new Set(["Bar"]))).toBe(true);
  });

  it("counts a plain port too, not only a collaborator named or imported as a use case", () => {
    const atLimit = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
    ) {}`;
    const withPlainPortOverLimit = `constructor(
      ${Array.from({ length: MAX_CONSTRUCTOR_DEPENDENCIES }, (_, i) => `private readonly a${i}: FooUseCase,`).join("\n")}
      private readonly extra?: ManifestRepository
    ) {}`;

    expect(overLimit(atLimit)).toBe(false);
    expect(overLimit(withPlainPortOverLimit)).toBe(true);
  });

  it.each([
    [
      "a readonly parameter property",
      "readonly a: A, readonly b: B, readonly c: C, readonly d: D, readonly e: E, readonly f: F",
    ],
    [
      "a parameter property with no readonly",
      "private a: A, private b: B, private c: C, private d: D, private e: E, private f: F",
    ],
    ["an untyped parameter", "a, b, c, d, e, f"],
    ["a destructured parameter, one dependency per name", "{ a, b, c, d, e, f }: Deps"],
    ["a plain typed parameter", "a: A, b: B, c: C, d: D, e: E, f: F"],
    [
      "a generic type holding a comma",
      "a: Map<string, A>, b: Map<string, B>, c: Map<string, C>, d: Map<string, D>, e: Map<string, E>, f: Map<string, F>",
    ],
    [
      "a function type holding a comma",
      "a: (x: A, y: B) => void, b: (x: A, y: B) => void, c: (x: A, y: B) => void, d: (x: A, y: B) => void, e: (x: A, y: B) => void, f: (x: A, y: B) => void",
    ],
  ])("counts %s", (_form, parameters) => {
    expect(overLimit(`constructor(${parameters}) {}`)).toBe(true);
    expect(overLimit(`constructor(${parameters.split(", ").slice(0, 5).join(", ")}) {}`)).toBe(
      false
    );
  });

  it("holds every class of a file to the limit, not only the first", () => {
    const parameters = (count: number) =>
      Array.from({ length: count }, (_, i) => `private readonly a${i}: A`).join(", ");
    const twoClasses = (first: number, second: number) =>
      `class One { constructor(${parameters(first)}) {} }\nclass Two { constructor(${parameters(second)}) {} }`;

    expect(overLimit(twoClasses(2, MAX_CONSTRUCTOR_DEPENDENCIES + 1))).toBe(true);
    expect(overLimit(twoClasses(2, MAX_CONSTRUCTOR_DEPENDENCIES))).toBe(false);
  });

  it("does not count the commas of a comment inside the parameters", () => {
    const withComments = `constructor(
      /** One of a, b, c, d, e, f: why. */
      private readonly a: A,
      // (x, y, z)
      private readonly b: B
    ) {}`;

    expect(constructorDependencyCount(withComments)).toBe(2);
  });
});
