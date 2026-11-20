/**
 * The rules Biome holds, planted and linted once. A rule Biome silently stops applying is
 * invisible, so each row of `PLANTS` names a file, what it holds, the rule that must fire and how
 * many times; a `times` of 0 is a file the rule must spare, and a file two overrides could both
 * match must draw both diagnostics, since Biome keeps only the last matching override's options.
 * The rest checks the shape of `biome.json` itself: the carriers of each rule, and the context
 * boundary overrides, which `scripts/generate-biome-boundaries.mjs` writes from the edge table in
 * `allowed-edges.ts`. Biome replaces a rule's whole `options` with the LAST override matching a
 * file rather than merging pattern arrays, so each file must carry exactly one
 * `noRestrictedImports` override.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type BiomeConfig,
  type BiomeOverride,
  type BoundaryInputs,
  boundaryInputs,
  boundaryOverrides,
  interiorGroupsOf,
  overrideIncludes,
  type RestrictedPattern,
  restrictedImportOptions,
} from "../../scripts/generate-biome-boundaries.mjs";
import { isRecord, parseJsonRecord } from "../shared/testing/json-value.builder.js";
import { ALLOWED, HELD_BY_BIOME } from "./allowed-edges.js";
import { PLANTS } from "./biome-plants.js";
import {
  biomeFindings,
  CLI_ROOT,
  matchesGlob,
  read,
  reportedFile,
  SRC,
  sourceFiles,
  tsFilesUnder,
} from "./helpers.js";

const PLUGIN = "biome-plugins/no-process-exit.grit";
const GITHUB_PLUGIN = "biome-plugins/one-github-api-url.grit";

/** The folders that import nothing from the platform or a package but the two modules that
 * hold no I/O. */
const PURE_FOLDERS = [
  "src/contexts/auth/domain/**/*.ts",
  "src/contexts/auth/ports/**/*.ts",
  "src/contexts/auth/contract/**/*.ts",
  "src/contexts/recipes/domain/**/*.ts",
  "src/contexts/recipes/ports/**/*.ts",
  "src/shared/domain/**/*.ts",
  "src/shared/ports/**/*.ts",
] as const;
const PURE_BUILTINS: ReadonlySet<string> = new Set(["path", "crypto"]);

interface Override extends BiomeOverride {
  plugins?: string[];
  linter?: NonNullable<BiomeOverride["linter"]> & {
    rules?: { style?: { noRestrictedGlobals?: { options?: unknown } } };
  };
}
interface BiomeFile extends BiomeConfig {
  overrides?: Override[];
}

const isBiomeFile = (value: unknown): value is BiomeFile =>
  isRecord(value) && (value.overrides === undefined || Array.isArray(value.overrides));

function biomeConfig(): BiomeFile {
  const value: unknown = JSON.parse(read("biome.json"));
  if (!isBiomeFile(value)) throw new Error("biome.json: expected `overrides` to be a list");
  return value;
}

describe("every rule Biome holds is planted and fires, once per breach", () => {
  let findings: string[];
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "aidd-biome-bite-"));
    cpSync(join(CLI_ROOT, "biome.json"), join(root, "biome.json"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(root, "biome-plugins"), { recursive: true });
    for (const [path, source] of PLANTS) {
      mkdirSync(join(root, dirname(path)), { recursive: true });
      writeFileSync(join(root, path), source.endsWith("\n") ? source : `${source}\n`);
    }
    findings = biomeFindings(root);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it.each(PLANTS)("%s draws its diagnostics", (path, _source, rule, times) => {
    expect(findings.filter((found) => found === `${path}:${rule}`)).toHaveLength(times);
  });

  it("draws nothing at all on a clean module", () => {
    expect(findings.filter((found) => found.startsWith("src/shared/domain/clean.ts"))).toEqual([]);
  });

  it("reads a file the GitHub reporter escaped, as on Windows", () => {
    expect(reportedFile("C%3A\\tmp\\a%2Cb%25.ts")).toBe("C:\\tmp\\a,b%.ts");
  });

  it("fails when biome does not run, rather than reading as no findings", () => {
    expect(() => biomeFindings(root, join(root, "missing-biome"))).toThrow(/biome did not run/);
  });
});

describe("biome carries the exit and default-export rules", () => {
  it("scopes the process.exit plugin to the layers that throw, and to nothing else", () => {
    const config = biomeConfig();
    const carrier = (config.overrides ?? []).find((o) => o.plugins?.includes(`./${PLUGIN}`));
    expect(carrier?.includes, `no override applies ${PLUGIN}`).toEqual([
      "src/shared/**",
      "src/contexts/**",
      "src/presentation/**",
      "!src/presentation/exit.ts",
    ]);
  });

  it("scopes the GitHub API URL plugin to the source, and spares the one adapter that writes it", () => {
    const config = biomeConfig();
    const carrier = (config.overrides ?? []).find((o) => o.plugins?.includes(`./${GITHUB_PLUGIN}`));
    expect(carrier?.includes, `no override applies ${GITHUB_PLUGIN}`).toEqual([
      "src/**",
      "!src/shared/infrastructure/github-adapter.ts",
    ]);
  });

  it("bans the process global across every context's domain and application", () => {
    const config = biomeConfig();
    const carrier = (config.overrides ?? []).find(
      (o) => o.linter?.rules?.style?.noRestrictedGlobals !== undefined
    );

    expect(
      carrier?.includes,
      "no override denies the process global to a context's domain and application"
    ).toEqual([
      "src/contexts/*/domain/**/*.ts",
      "src/contexts/*/application/**/*.ts",
      "src/contexts/*/ports/**/*.ts",
      "src/contexts/*/contract/**/*.ts",
      "src/shared/domain/**/*.ts",
      "src/shared/ports/**/*.ts",
    ]);
  });

  it("denies a pure folder every package and every Node builtin but path and crypto", () => {
    const config = biomeConfig();
    const deniedBy = (includes: string): string[] => {
      const override = (config.overrides ?? []).find((o) => o.includes?.[0] === includes);
      return Object.keys(override?.linter?.rules?.style?.noRestrictedImports?.options?.paths ?? {});
    };
    const { dependencies } = parseJsonRecord(read("package.json"));
    const builtins = [...new Set(builtinModules.map((name) => name.replace(/^node:/, "")))]
      .filter((name) => !PURE_BUILTINS.has(name))
      .flatMap((name) => [name, `node:${name}`]);

    for (const includes of PURE_FOLDERS) {
      const denied = deniedBy(includes);
      expect(denied.length, `no import path denied at ${includes}`).toBeGreaterThan(0);
      expect(
        builtins.filter((name) => !denied.includes(name)),
        `${includes} lets through a builtin this Node knows`
      ).toEqual([]);
      for (const allowed of PURE_BUILTINS) {
        expect(denied, `${includes} denies ${allowed}`).not.toContain(allowed);
        expect(denied, `${includes} denies node:${allowed}`).not.toContain(`node:${allowed}`);
      }
      expect(
        Object.keys(isRecord(dependencies) ? dependencies : {}).filter(
          (name) => !denied.includes(name)
        ),
        `${includes} lets through a dependency of package.json`
      ).toEqual([]);
    }
  });

  it("bans the filesystem and child processes in a unit test, and in nothing else", () => {
    const config = biomeConfig();
    const carrier = (config.overrides ?? []).find(
      (o) =>
        o.linter?.rules?.style?.noRestrictedImports?.options?.paths !== undefined &&
        !PURE_FOLDERS.some((folder) => folder === o.includes?.[0]) &&
        o.includes?.[0]?.startsWith("tests/")
    );

    expect(carrier?.includes, "no override denies fs and child_process to a unit test").toEqual([
      "tests/**/*.unit.test.ts",
      "!tests/contexts/**",
    ]);
  });
});

const committed = biomeConfig();
const input = boundaryInputs(
  SRC,
  { allowed: ALLOWED, heldByBiome: HELD_BY_BIOME },
  join(CLI_ROOT, "tests")
);

function restrictedGroups(override: BiomeOverride): string[] | undefined {
  return restrictedImportOptions(override)?.patterns?.flatMap((pattern) => pattern.group ?? []);
}

/** A glob as biome reads it: a trailing `/**` takes everything beneath, which `matchesGlob` does not. */
const biomeGlob = (glob: string) => (glob.endsWith("/**") ? `${glob}/*` : glob);

function filesMatchedTwice(
  files: readonly string[],
  includes: readonly (readonly string[])[]
): string[] {
  return files.filter(
    (file) =>
      includes.filter(
        (globs) =>
          globs.some((glob) => !glob.startsWith("!") && matchesGlob(biomeGlob(glob), file)) &&
          !globs.some((glob) => glob.startsWith("!") && matchesGlob(biomeGlob(glob.slice(1)), file))
      ).length > 1
  );
}

/** The scopes of the overrides whose groups differ from what the table generates. */
function drifted(config: BiomeConfig, table: BoundaryInputs): string[] {
  const generated = boundaryOverrides(config, table).overrides ?? [];
  return (config.overrides ?? [])
    .filter((override, index) => !isDeepStrictEqual(override, generated[index]))
    .map((override) => (override.includes ?? []).join(", "));
}

describe("cli/biome.json holds exactly the edges the table admits", () => {
  const overrides = (committed.overrides ?? []).filter(restrictedGroups);

  it("finds context and layer overrides to check, so this rule cannot pass by selecting nothing", () => {
    expect(
      overrides.length,
      "no noRestrictedImports override found: the scope is stale"
    ).toBeGreaterThan(10);
    expect(input.contexts.length, "no context found under src/contexts/").toBeGreaterThan(3);
  });

  it("at most one noRestrictedImports override matches any source file", () => {
    expect(
      filesMatchedTwice(
        sourceFiles(),
        overrides.map((override) => override.includes ?? [])
      ),
      "a file matched by two noRestrictedImports overrides silently loses the first"
    ).toEqual([]);
  });

  it("at most one noRestrictedImports override matches any test file", () => {
    expect(
      filesMatchedTwice(
        tsFilesUnder("tests"),
        overrides.map((override) => override.includes ?? [])
      ),
      "a file matched by two noRestrictedImports overrides silently loses the first"
    ).toEqual([]);
  });

  it("every context layer override equals the one generated from the table", () => {
    expect(
      drifted(committed, input),
      "regenerate with `pnpm biome:boundaries`: biome.json differs from the edge table"
    ).toEqual([]);
  });

  it.each([
    {
      includes: "src/shared/domain/**/*.ts",
      forbids: ["contexts", "presentation", "infrastructure", "composition"],
    },
    {
      includes: "src/shared/ports/**/*.ts",
      forbids: ["contexts", "presentation", "infrastructure", "composition"],
    },
    {
      includes: "src/shared/infrastructure/**/*.ts",
      forbids: ["contexts", "presentation", "composition"],
    },
    {
      includes: "src/presentation/**/*.ts",
      forbids: [
        "**/shared/infrastructure/**",
        "composition",
        ...HELD_BY_BIOME.flatMap((held) => interiorGroupsOf(held, `${SRC}/contexts`)),
      ],
    },
  ])("$includes forbids exactly its groups", ({ includes, forbids }) => {
    const override = overrides.find((candidate) => candidate.includes?.includes(includes));
    if (!override) throw new Error(`no override at ${includes}`);

    const tokens = (restrictedGroups(override) ?? []).map((group) =>
      /^\*\*\/([^/]+)\/\*\*$/.test(group) ? group.slice(3, -3) : group
    );
    expect(new Set(tokens)).toEqual(new Set(forbids));
  });
});

describe("the generator", () => {
  const table: BoundaryInputs = {
    contexts: ["auth", "installation", "tools"],
    allowed: new Set(["installation->tools"]),
    heldByBiome: ["tools"],
    layersOf: () => ["domain"],
    interiorGroupsOf: () => ["**/tools/domain/**"],
  };
  const pattern = (group: string[], message: string) => ({ group, message });
  const override = (context: string, patterns: RestrictedPattern[]): BiomeOverride => ({
    includes: [overrideIncludes(context, "domain")],
    linter: { rules: { style: { noRestrictedImports: { options: { patterns } } } } },
  });
  // Built fresh each time: a clone keeps the sharing between two overrides, so one edit would reach both.
  const layer = () =>
    pattern(["**/application/**", "**/infrastructure/**", "**/presentation/**"], "l");
  const composition = () => pattern(["**/composition/**"], "c");
  const build = (): BiomeConfig => ({
    overrides: [
      override("auth", [
        layer(),
        pattern(["**/installation/**", "**/tools/**"], "e"),
        composition(),
      ]),
      override("installation", [
        layer(),
        pattern(["**/auth/**"], "e"),
        composition(),
        pattern(["**/tools/domain/**"], "i"),
      ]),
      override("tools", [
        layer(),
        pattern(["**/auth/**", "**/installation/**"], "e"),
        composition(),
      ]),
    ],
  });
  const INSTALLATION = "src/contexts/installation/domain/**/*.ts";

  /** The patterns of the override at `index`. */
  function patternsAt(config: BiomeConfig, index: number): RestrictedPattern[] {
    const found = config.overrides?.[index];
    const patterns = found && restrictedImportOptions(found)?.patterns;
    if (!patterns) throw new Error(`no restricted patterns at override ${index}`);
    return patterns;
  }

  /** A table-true config with one group list replaced. */
  function edited(index: number, patternIndex: number, group: string[]): BiomeConfig {
    const config = build();
    const found = patternsAt(config, index)[patternIndex];
    if (!found) throw new Error(`no pattern ${patternIndex} at override ${index}`);
    found.group = group;
    return config;
  }

  it("holds a table-true config as it is", () => {
    expect(drifted(build(), table)).toEqual([]);
  });

  it("names the override a hand edit of one of its groups leaves different", () => {
    const edge = edited(1, 1, ["**/auth/**", "**/tools/**"]);
    const interior = edited(1, 3, ["**/tools/domain/**", "**/tools/ports/**"]);
    const direction = edited(1, 0, ["**/application/**"]);

    expect(drifted(edge, table)).toEqual([INSTALLATION]);
    expect(drifted(interior, table)).toEqual([INSTALLATION]);
    expect(drifted(direction, table)).toEqual([INSTALLATION]);
  });

  it("refuses a second layer pattern, which a hand edit of the composition group makes", () => {
    const widened = edited(1, 2, ["**/composition/**", "**/shared/**"]);

    expect(() => drifted(widened, table)).toThrow("2 layer patterns");
  });

  it("refuses a layer with no override, rather than invent its rationale", () => {
    expect(() => boundaryOverrides(build(), { ...table, layersOf: () => ["contract"] })).toThrow(
      "no override at src/contexts/auth/contract/**/*.ts"
    );
  });

  it("refuses an admitted edge whose interior has no pattern to carry its message", () => {
    const missing = build();
    patternsAt(missing, 1).pop();

    expect(() => boundaryOverrides(missing, table)).toThrow("0 interior patterns");
  });

  it("folds a second edge pattern into the first", () => {
    const split = build();
    patternsAt(split, 2).push(pattern(["**/auth/**"], "split"));

    const generated = patternsAt(boundaryOverrides(split, table), 2);
    expect(drifted(split, table)).toEqual(["src/contexts/tools/domain/**/*.ts"]);
    expect(generated).toHaveLength(3);
  });

  describe("for the tests of a context", () => {
    const withTests: BoundaryInputs = { ...table, testContexts: ["auth", "installation"] };
    const base = (): BiomeConfig => ({
      overrides: [
        ...(build().overrides ?? []),
        {
          includes: ["tests/**/*.unit.test.ts", "!tests/contexts/**"],
          linter: {
            rules: { style: { noRestrictedImports: { options: { paths: { "node:fs": "x" } } } } },
          },
        },
      ],
    });
    const generated = () => boundaryOverrides(base(), withTests).overrides ?? [];
    const tested = () =>
      generated().filter((found) => found.includes?.[0]?.startsWith("tests/contexts/"));
    const groupsOf = (index: number) => restrictedGroups(tested()[index] ?? {});

    it("adds a unit and a non-unit override per test context, after the unit base", () => {
      const scopes = generated().map((found) => found.includes?.[0]);
      expect(scopes.slice(scopes.indexOf("tests/**/*.unit.test.ts"))).toEqual([
        "tests/**/*.unit.test.ts",
        "tests/contexts/auth/**/*.unit.test.ts",
        "tests/contexts/auth/**/*.ts",
        "tests/contexts/installation/**/*.unit.test.ts",
        "tests/contexts/installation/**/*.ts",
      ]);
    });

    it("bars every other context's interior and spares its application and contract", () => {
      expect(groupsOf(1)).toEqual([
        "**/contexts/installation/**",
        "!**/contexts/installation/application/**",
        "!**/contexts/installation/contract/**",
        "**/contexts/tools/**",
        "!**/contexts/tools/application/**",
        "!**/contexts/tools/contract/**",
      ]);
    });

    it("keeps the unit base's disk bans on the unit override", () => {
      const unit = tested()[0];
      expect(unit && restrictedImportOptions(unit)?.paths).toEqual({ "node:fs": "x" });
    });

    it("regenerates the same override whatever it held before", () => {
      const once = boundaryOverrides(base(), withTests);
      expect(boundaryOverrides(once, withTests)).toEqual(once);
    });
  });
});
