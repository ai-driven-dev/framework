/**
 * Measured: biome replaces a rule's whole `options` with the LAST override matching a file
 * rather than merging pattern arrays, so a broader override silently discards a narrower
 * one's restriction. Every override checked here is scoped to one context's one layer.
 */
import { describe, expect, it } from "vitest";
import {
  ALLOWED,
  baselineLayers,
  contextNames,
  HELD_BY_BIOME,
  interiorGroupsOf,
  matchesGlob,
  read,
  sourceFiles,
} from "./helpers.js";

type Layer = "domain" | "application" | "infrastructure" | "ports" | "contract";
/** Every context has these three. */
const LAYERS: readonly Layer[] = ["domain", "application", "infrastructure"];
/** A migrated context also has these, and is held to them wherever the folder exists: a
 * `contract/` folder with no override of its own is a folder nothing restricts. */
const OPTIONAL_LAYERS: readonly Layer[] = ["ports", "contract"];
/** The negation that keeps `**\/domain/**` from forbidding `shared/domain/`. */
const SHARED_DOMAIN_TAKEN_BACK = "!**/shared/domain/**";

interface BiomeOverride {
  readonly includes?: readonly string[];
  readonly linter?: {
    readonly rules?: {
      readonly style?: {
        readonly noRestrictedImports?: {
          readonly options?: {
            readonly patterns?: readonly { readonly group?: readonly string[] }[];
          };
        };
      };
    };
  };
}

function biomeOverrides(): BiomeOverride[] {
  const config = JSON.parse(read("biome.json")) as { overrides?: BiomeOverride[] };
  return config.overrides ?? [];
}

function restrictedImportGroups(override: BiomeOverride): string[] | undefined {
  const patterns = override.linter?.rules?.style?.noRestrictedImports?.options?.patterns;
  if (!patterns) return undefined;
  return patterns.flatMap((entry) => entry.group ?? []);
}

/** `"**\/foo/**"` reads as the context or layer named `foo`; another shape is not a graph
 * edge, and is left as-is for the allowlist below to recognise. */
function tokenOf(pattern: string): string {
  const match = /^\*\*\/([^/]+)\/\*\*$/.exec(pattern);
  return match ? (match[1] as string) : pattern;
}

/**
 * Patterns naming something other than a graph edge, so a deliberate narrower restriction is
 * not read as drift: `distribution` reads a marketplace, never framework's installation
 * record, which is stricter than the edge itself.
 */
const NON_GRAPH_EXTRA: Readonly<Record<string, readonly string[]>> = {
  "distribution/domain": ["**/manifest.js"],
  "distribution/application": ["**/manifest.js"],
};

/** The layer-intrinsic direction: what any file at this layer must not import, whatever its
 * context. */
function genericLayerTargets(layer: Layer): ReadonlySet<string> {
  if (layer === "domain") {
    return new Set(["application", "infrastructure", "presentation"]);
  }
  if (layer === "ports") return genericLayerTargets("domain");
  if (layer === "contract") {
    return new Set(["domain", "application", "infrastructure", "ports", "presentation"]);
  }
  if (layer === "application") return new Set(["infrastructure"]);
  return new Set(["**/shared/infrastructure/**"]);
}

/**
 * The layer-intrinsic direction, union every context, presentation and the composition
 * this context may not reach, minus what `ALLOWED` admits and minus the debt `BASELINE`
 * carries at this layer.
 */
function expectedForbidden(
  context: string,
  layer: Layer,
  contexts: readonly string[],
  baselineLayerMap: ReadonlyMap<string, ReadonlySet<string>>
): Set<string> {
  const forbidden = new Set(genericLayerTargets(layer));
  const others = contexts.filter((name) => name !== context);
  for (const target of [...others, "presentation", "composition"]) {
    const edge = `${context}->${target}`;
    if (ALLOWED.has(edge)) continue;
    if (baselineLayerMap.get(edge)?.has(layer)) continue;
    forbidden.add(target);
  }
  return forbidden;
}

/**
 * The folder groups a context's overrides carry for each held context it may import: the
 * edge is admitted, so only the contract and the commands are open to it.
 */
function interiorGroupsFor(context: string): string[] {
  return HELD_BY_BIOME.filter(
    (held) => held !== context && ALLOWED.has(`${context}->${held}`)
  ).flatMap(interiorGroupsOf);
}

function layersOf(context: string, files: readonly string[]): Layer[] {
  const optional = OPTIONAL_LAYERS.filter((layer) =>
    files.some((file) => file.startsWith(`src/contexts/${context}/${layer}/`))
  );
  return [...LAYERS, ...optional];
}

function contextLayerIncludes(context: string, layer: Layer): string {
  return `src/contexts/${context}/${layer}/**/*.ts`;
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

describe("cli/biome.json forbids exactly the edges context-graph.arch.test.ts forbids", () => {
  const overrides = biomeOverrides().filter((override) => restrictedImportGroups(override));
  const contexts = contextNames();
  const baselineLayerMap = baselineLayers(sourceFiles());

  it("finds context/layer overrides to check, so this rule cannot pass by selecting nothing", () => {
    expect(
      overrides.length,
      "no noRestrictedImports override found — the scope of this rule is stale"
    ).toBeGreaterThan(10);
    expect(contexts.length, "no context found under src/contexts/").toBeGreaterThan(3);
  });

  it("at most one noRestrictedImports override matches any source file", () => {
    const matchedByMoreThanOne = filesMatchedTwice(
      sourceFiles(),
      overrides.map((override) => override.includes ?? [])
    );

    expect(
      matchedByMoreThanOne,
      "biome replaces a rule's options with the last matching override rather than merging " +
        "them — a file matched by two noRestrictedImports overrides silently loses the first"
    ).toEqual([]);
  });

  it.each(
    contexts.flatMap((context) =>
      layersOf(context, sourceFiles()).map((layer) => ({ context, layer }))
    )
  )(
    "$context/$layer forbids exactly what context-graph.arch.test.ts forbids",
    ({ context, layer }) => {
      const includesGlob = contextLayerIncludes(context, layer);
      const override = overrides.find((candidate) => candidate.includes?.includes(includesGlob));
      expect(override, `no override at ${includesGlob}`).toBeDefined();

      const groups = restrictedImportGroups(override as BiomeOverride) ?? [];
      const extra = new Set(NON_GRAPH_EXTRA[`${context}/${layer}`] ?? []);
      const actual = new Set(
        groups.filter((pattern) => !extra.has(pattern)).map((pattern) => tokenOf(pattern))
      );
      const expected = expectedForbidden(context, layer, contexts, baselineLayerMap);
      for (const group of interiorGroupsFor(context)) expected.add(group);
      // A contract names `domain` as a layer it may not reach, and takes back the shared one.
      if (layer === "contract") expected.add(SHARED_DOMAIN_TAKEN_BACK);

      expect([...actual].sort()).toEqual([...expected].sort());
    }
  );

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
        ...HELD_BY_BIOME.flatMap(interiorGroupsOf),
      ],
    },
  ])("$includes forbids exactly its groups", ({ includes, forbids }) => {
    const override = overrides.find((candidate) => candidate.includes?.includes(includes));
    expect(override, `no override at ${includes}`).toBeDefined();

    const groups = (restrictedImportGroups(override as BiomeOverride) ?? []).map(tokenOf);
    expect(new Set(groups)).toEqual(new Set(forbids));
  });
});

describe("the guard itself", () => {
  const twoContexts = ["framework", "tools"];

  it("names a file two overrides both match, and clears one only a single override reaches", () => {
    const files = ["src/contexts/tools/domain/registry.ts", "src/shared/domain/tool.ts"];
    const includes = [["src/contexts/**/*.ts"], ["src/contexts/tools/domain/**/*.ts"]];

    expect(filesMatchedTwice(files, includes)).toEqual(["src/contexts/tools/domain/registry.ts"]);
    expect(filesMatchedTwice(files, [includes[0] as string[]])).toEqual([]);
  });

  it("forbids a context the graph does not admit, and drops one it does", () => {
    const noBaseline = new Map<string, ReadonlySet<string>>();

    expect(
      expectedForbidden("tools", "domain", twoContexts, noBaseline).has("framework"),
      "tools->framework is no allowed edge"
    ).toBe(true);
    expect(
      expectedForbidden("framework", "domain", twoContexts, noBaseline).has("tools"),
      "framework->tools is one"
    ).toBe(false);
  });

  it("holds a ports folder to what the domain is held to, and a contract folder to no sibling", () => {
    const none = new Map<string, ReadonlySet<string>>();
    const forbidden = (layer: Layer) => expectedForbidden("auth", layer, ["auth", "tools"], none);

    expect([...forbidden("ports")].sort()).toEqual([...forbidden("domain")].sort());
    expect(forbidden("contract").has("domain")).toBe(true);
    expect(forbidden("contract").has("ports")).toBe(true);
    expect(forbidden("domain").has("ports")).toBe(false);
  });

  it("asks an importer of a held context for the interior groups, and no other context", () => {
    expect(interiorGroupsFor("distribution")).toEqual(interiorGroupsOf("auth"));
    expect(interiorGroupsFor("framework")).toEqual([
      ...interiorGroupsOf("auth"),
      ...interiorGroupsOf("host-registration"),
      ...interiorGroupsOf("tools"),
    ]);
    expect(
      interiorGroupsFor("tools"),
      "tools->auth is no edge: `**/auth/**` already forbids it"
    ).toEqual([]);
    expect(interiorGroupsFor("auth"), "a context keeps its own interior").toEqual([]);
    expect(interiorGroupsOf("auth")).toEqual([
      "**/auth/domain/**",
      "**/auth/ports/**",
      "**/auth/infrastructure/**",
    ]);
  });

  it("lists a ports or contract folder only where it exists", () => {
    const files = ["src/contexts/auth/contract/x.ts", "src/contexts/tools/domain/y.ts"];

    expect(layersOf("auth", files)).toEqual([
      "domain",
      "application",
      "infrastructure",
      "contract",
    ]);
    expect(layersOf("tools", files)).toEqual(["domain", "application", "infrastructure"]);
  });

  it("drops a target the baseline already carries at that layer, and keeps it at another", () => {
    const debt = new Map([["tools->framework", new Set(["domain"])]]);

    expect(expectedForbidden("tools", "domain", twoContexts, debt).has("framework")).toBe(false);
    expect(expectedForbidden("tools", "application", twoContexts, debt).has("framework")).toBe(
      true
    );
  });
});
