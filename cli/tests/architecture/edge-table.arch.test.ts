/**
 * The context boundary groups of `biome.json` are derived from the edge table
 * (`allowed-edges.ts`) by `scripts/generate-biome-boundaries.mjs`. Biome replaces a rule's whole
 * `options` with the LAST override matching a file rather than merging pattern arrays, so each
 * file must carry exactly one `noRestrictedImports` override.
 */
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
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
import { ALLOWED, HELD_BY_BIOME } from "./allowed-edges.js";
import { matchesGlob, read, SRC, sourceFiles } from "./helpers.js";

const committed: BiomeConfig = JSON.parse(read("biome.json"));
const input = boundaryInputs(SRC, { allowed: ALLOWED, heldByBiome: HELD_BY_BIOME });

function restrictedGroups(override: BiomeOverride): string[] | undefined {
  return restrictedImportOptions(override)?.patterns?.flatMap((pattern) => pattern.group ?? []);
}

function filesMatchedTwice(
  files: readonly string[],
  includes: readonly (readonly string[])[]
): string[] {
  return files.filter(
    (file) =>
      includes.filter(
        (globs) =>
          globs.some((glob) => !glob.startsWith("!") && matchesGlob(glob, file)) &&
          !globs.some((glob) => glob.startsWith("!") && matchesGlob(glob.slice(1), file))
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
});
