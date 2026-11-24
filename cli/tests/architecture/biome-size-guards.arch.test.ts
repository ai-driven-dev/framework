/**
 * The size guards Biome carries, per kind of file: each guard's rule, scope and cap in
 * `biome.json`, and a planted violator that makes each guard bite, one step past its cap.
 * What a rule spares, rather than caps, is guarded by `biome-exemptions.arch.test.ts`.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { biomeConfig, type Override } from "./biome-config.js";
import {
  branches,
  constants,
  constructorWith,
  fourParams,
  longFunction,
  tangled,
  twoClasses,
} from "./size-plants.js";
import { biomeFindings, CLI_ROOT } from "./source-graph.js";

const ERROR_FILES = "!**/*.error.ts";
/** Files that declare shape, not behaviour: the composition, the profiles and the contracts. */
const DECLARATIONS = [
  "src/composition/**",
  "src/contexts/tools/domain/behaviours/**",
  "src/contexts/*/contract/**",
];

interface RuleGuard {
  readonly name: string;
  readonly group: string;
  readonly rule: string;
  readonly includes: readonly string[];
  readonly options: Readonly<Record<string, unknown>>;
}

const lines = (maxLines: number): Record<string, unknown> => ({ maxLines, skipBlankLines: true });

const RULES: readonly RuleGuard[] = [
  {
    name: "function length in src",
    group: "complexity",
    rule: "noExcessiveLinesPerFunction",
    includes: ["src/**"],
    options: lines(30),
  },
  {
    name: "cognitive complexity in src",
    group: "complexity",
    rule: "noExcessiveCognitiveComplexity",
    includes: ["src/**"],
    options: { maxAllowedComplexity: 8 },
  },
  {
    name: "cognitive complexity in tests",
    group: "complexity",
    rule: "noExcessiveCognitiveComplexity",
    includes: ["tests/**"],
    options: { maxAllowedComplexity: 8 },
  },
  {
    name: "one class per file",
    group: "style",
    rule: "noExcessiveClassesPerFile",
    includes: ["src/**", ERROR_FILES],
    options: { maxClasses: 1 },
  },
  {
    name: "file length in src",
    group: "style",
    rule: "noExcessiveLinesPerFile",
    includes: ["src/**", ERROR_FILES, ...DECLARATIONS.map((glob) => `!${glob}`)],
    options: lines(150),
  },
  {
    name: "file length of declarations",
    group: "style",
    rule: "noExcessiveLinesPerFile",
    includes: DECLARATIONS,
    options: lines(300),
  },
  {
    name: "file length in tests",
    group: "style",
    rule: "noExcessiveLinesPerFile",
    includes: ["tests/**"],
    options: lines(800),
  },
];

const PARAMS_PLUGIN = "./biome-plugins/max-function-params.grit";
const CONSTRUCTOR_PLUGIN = "./biome-plugins/max-constructor-params.grit";

const overrides = (): readonly Override[] => biomeConfig().overrides ?? [];

const carriesRule = (override: Override, guard: RuleGuard): boolean =>
  override.linter?.rules?.[guard.group]?.[guard.rule] !== undefined &&
  JSON.stringify(override.includes) === JSON.stringify(guard.includes);

describe("biome carries the size guards", () => {
  for (const guard of RULES) {
    it(`${guard.name}: one override carries it alone, scoped and capped`, () => {
      const carriers = overrides().filter((override) => carriesRule(override, guard));
      expect(carriers, `${guard.name} must sit in exactly one override`).toHaveLength(1);
      const [carrier] = carriers;
      expect(Object.keys(carrier ?? {}).sort()).toEqual(["includes", "linter"]);
      expect(Object.keys(carrier?.linter ?? {})).toEqual(["rules"]);
      expect(carrier?.linter?.rules?.[guard.group]).toEqual({
        [guard.rule]: { level: "error", options: guard.options },
      });
      expect(Object.keys(carrier?.linter?.rules ?? {})).toEqual([guard.group]);
    });
  }

  it("parameter caps: one plugin override on src, and no second mechanism beside it", () => {
    const carriers = overrides().filter((o) => o.plugins?.includes(PARAMS_PLUGIN));
    expect(carriers).toHaveLength(1);
    expect(carriers[0]).toEqual({
      includes: ["src/**"],
      plugins: [PARAMS_PLUGIN, CONSTRUCTOR_PLUGIN],
    });
    expect(JSON.stringify(biomeConfig())).not.toContain("useMaxParams");
  });

  it("every override naming a size rule is one of the guards above", () => {
    const sizeRule = (override: Override): boolean =>
      Object.values(override.linter?.rules ?? {}).some((group) =>
        Object.keys(group ?? {}).some((rule) => /^noExcessive/.test(rule))
      );
    expect(overrides().filter(sizeRule)).toHaveLength(RULES.length);
  });
});

const FN = "lint/complexity/noExcessiveLinesPerFunction";
const COMPLEXITY = "lint/complexity/noExcessiveCognitiveComplexity";
const CLASSES = "lint/style/noExcessiveClassesPerFile";
const FILE = "lint/style/noExcessiveLinesPerFile";
const PARAMS = "plugin";
const SIZE_IDS = new Set([FN, COMPLEXITY, CLASSES, FILE, PARAMS]);

interface Plant {
  readonly path: string;
  readonly content: string;
  /** The guards that must flag the file, and no others. */
  readonly flags: readonly string[];
}

const threeParams =
  "export function three(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n";

const PLANTS: readonly Plant[] = [
  // src: function 30, complexity 8, file 150, one class, three parameters.
  { path: "src/kernel/over-function.ts", content: longFunction("over", 29), flags: [FN] },
  { path: "src/kernel/at-function.ts", content: longFunction("at", 28), flags: [] },
  { path: "src/kernel/over-complexity.ts", content: branches("over", 9), flags: [COMPLEXITY] },
  { path: "src/kernel/at-complexity.ts", content: branches("at", 8), flags: [] },
  { path: "src/kernel/over-file.ts", content: constants(151, "v"), flags: [FILE] },
  { path: "src/kernel/at-file.ts", content: constants(150, "w"), flags: [] },
  { path: "src/kernel/two-classes.ts", content: twoClasses(""), flags: [CLASSES] },
  { path: "src/kernel/four-params.ts", content: fourParams(""), flags: [PARAMS] },
  { path: "src/kernel/three-params.ts", content: threeParams, flags: [] },
  { path: "src/kernel/six-ctor-params.ts", content: constructorWith(6, "Six"), flags: [PARAMS] },
  { path: "src/kernel/five-ctor-params.ts", content: constructorWith(5, "Five"), flags: [] },
  // an error file holds many small classes: no class or line cap, every other guard applies.
  { path: "src/kernel/errors.error.ts", content: twoClasses("Errors"), flags: [] },
  { path: "src/kernel/long.error.ts", content: constants(420, "e"), flags: [] },
  { path: "src/kernel/tangled.error.ts", content: tangled("tangleErrors"), flags: [COMPLEXITY] },
  // declarations: file 300, and the same function and complexity caps as any src file.
  { path: "src/composition/over-file.ts", content: constants(301, "a"), flags: [FILE] },
  { path: "src/composition/at-file.ts", content: constants(300, "b"), flags: [] },
  { path: "src/composition/over-function.ts", content: longFunction("over", 29), flags: [FN] },
  {
    path: "src/contexts/tools/domain/behaviours/over-file.ts",
    content: constants(301, "c"),
    flags: [FILE],
  },
  {
    path: "src/contexts/tools/domain/behaviours/at-file.ts",
    content: constants(300, "d"),
    flags: [],
  },
  {
    path: "src/contexts/telemetry/contract/over-file.ts",
    content: constants(301, "f"),
    flags: [FILE],
  },
  { path: "src/contexts/telemetry/contract/at-file.ts", content: constants(300, "g"), flags: [] },
  {
    path: "src/contexts/telemetry/contract/tangled.ts",
    content: tangled("tangle"),
    flags: [COMPLEXITY],
  },
  // tests: file 800 and complexity 8 only.
  { path: "tests/kernel/over-file.ts", content: constants(801, "t"), flags: [FILE] },
  { path: "tests/kernel/at-file.ts", content: constants(800, "u"), flags: [] },
  { path: "tests/kernel/mid-file.ts", content: constants(151, "m"), flags: [] },
  { path: "tests/kernel/over-complexity.ts", content: branches("over", 9), flags: [COMPLEXITY] },
  { path: "tests/kernel/at-complexity.ts", content: branches("at", 8), flags: [] },
  {
    path: "tests/kernel/other-caps.ts",
    content: [longFunction("sixty", 60), twoClasses("Tests"), fourParams("Tests")].join("\n"),
    flags: [],
  },
];

describe("the size guards bite", () => {
  let planted: string;
  let findings: string[];

  const idsFlagging = (path: string): string[] =>
    [
      ...new Set(
        findings
          .filter((finding) => finding.startsWith(`${path}:`))
          .map((finding) => finding.slice(finding.lastIndexOf(":") + 1))
          .filter((id) => SIZE_IDS.has(id))
      ),
    ].sort();

  beforeAll(() => {
    planted = mkdtempSync(join(tmpdir(), "aidd-size-guards-bite-"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(planted, "biome-plugins"), { recursive: true });
    for (const { path, content } of PLANTS) {
      mkdirSync(join(planted, dirname(path)), { recursive: true });
      writeFileSync(join(planted, path), content);
    }
    writeFileSync(join(planted, "biome.json"), JSON.stringify(biomeConfig()));
    findings = biomeFindings(planted);
  }, 60_000);

  afterAll(() => {
    rmSync(planted, { recursive: true, force: true });
  });

  for (const { path, flags } of PLANTS) {
    it(`${path} is flagged by ${flags.length === 0 ? "no size guard" : flags.join(", ")}`, () => {
      expect(idsFlagging(path), findings.join(", ")).toEqual([...flags].sort());
    });
  }

  it("counts a function, an arrow, a method and a signature, four times over", () => {
    expect(
      findings.filter((finding) => finding === `src/kernel/four-params.ts:${PARAMS}`)
    ).toHaveLength(4);
  });
});
