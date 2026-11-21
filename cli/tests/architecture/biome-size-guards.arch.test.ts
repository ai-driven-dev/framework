/**
 * The size guards Biome carries: each guard's plugin, rule and baseline in `biome.json`, the
 * baselines that only shrink, and a planted violator that makes each guard bite.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.builder.js";
import { biomeConfig, type Override } from "./biome-config.js";
import {
  branches,
  constants,
  fourParams,
  longFunction,
  tangled,
  twoClasses,
} from "./size-plants.js";
import { biomeFindings, CLI_ROOT, expectRatchet } from "./source-graph.js";

type SizeGuard =
  | {
      readonly name: string;
      readonly kind: "rule";
      readonly group: string;
      readonly rule: string;
      readonly options: Readonly<Record<string, unknown>>;
      /** Excused for a whole kind of file, not one by one: the error catalogue. */
      readonly sparesErrorFiles?: true;
    }
  | { readonly name: string; readonly kind: "plugin"; readonly file: string };

const GUARDS: readonly SizeGuard[] = [
  {
    name: "function length",
    kind: "rule",
    group: "complexity",
    rule: "noExcessiveLinesPerFunction",
    options: { maxLines: 50, skipBlankLines: true },
  },
  {
    name: "cognitive complexity",
    kind: "rule",
    group: "complexity",
    rule: "noExcessiveCognitiveComplexity",
    options: { maxAllowedComplexity: 15 },
  },
  {
    name: "one class per file",
    kind: "rule",
    group: "style",
    rule: "noExcessiveClassesPerFile",
    options: { maxClasses: 1 },
    sparesErrorFiles: true,
  },
  {
    name: "file length",
    kind: "rule",
    group: "style",
    rule: "noExcessiveLinesPerFile",
    options: { maxLines: 400, skipBlankLines: true },
    sparesErrorFiles: true,
  },
  { name: "function parameters", kind: "plugin", file: "max-function-params.grit" },
];

const overrides = (): readonly Override[] => biomeConfig().overrides ?? [];

/** A file of the error catalogue holds many small classes: no guard counts them per file. */
const ERROR_FILES = "!**/*.error.ts";

const pluginPath = (file: string): string => `./biome-plugins/${file}`;

function carriersOf(guard: SizeGuard): Override[] {
  return overrides().filter((o) =>
    guard.kind === "rule"
      ? o.linter?.rules?.[guard.group]?.[guard.rule] !== undefined
      : o.plugins?.includes(pluginPath(guard.file))
  );
}

function carrierOf(guard: SizeGuard): Override {
  const [carrier] = carriersOf(guard);
  if (carrier === undefined) throw new Error(`no override carries ${guard.name}`);
  return carrier;
}

/** The files a guard's override excludes: its baseline. */
function baselineOf(guard: SizeGuard): string[] {
  return (carrierOf(guard).includes ?? [])
    .slice(1)
    .filter((entry) => entry !== ERROR_FILES)
    .map((entry) => entry.slice(1))
    .sort();
}

/** The finding id biome prints for a guard: a rule's path, or `plugin`. */
const findingId = (guard: SizeGuard): string =>
  guard.kind === "rule" ? `lint/${guard.group}/${guard.rule}` : "plugin";

describe("biome carries the size guards", () => {
  for (const guard of GUARDS) {
    describe(guard.name, () => {
      it("is carried by exactly one override, and that override carries nothing else", () => {
        const carriers = carriersOf(guard);
        expect(carriers, `${guard.name} must sit in exactly one override`).toHaveLength(1);
        const carrier = present(carriers[0]);

        if (guard.kind === "plugin") {
          expect(Object.keys(carrier).sort()).toEqual(["includes", "plugins"]);
          expect(carrier.plugins).toEqual([pluginPath(guard.file)]);
          return;
        }
        expect(Object.keys(carrier).sort()).toEqual(["includes", "linter"]);
        expect(Object.keys(carrier.linter ?? {})).toEqual(["rules"]);
        expect(Object.keys(carrier.linter?.rules ?? {})).toEqual([guard.group]);
        expect(Object.keys(carrier.linter?.rules?.[guard.group] ?? {})).toEqual([guard.rule]);
        expect(carrier.linter?.rules?.[guard.group]?.[guard.rule]).toEqual({
          level: "error",
          options: guard.options,
        });
      });

      it("excludes no file", () => {
        expect(
          baselineOf(guard),
          `${guard.name} excludes nothing: a new violator is fixed, never excluded`
        ).toEqual([]);
      });

      it("applies to src/** and excludes exact, sorted, unique files only", () => {
        const includes = carrierOf(guard).includes ?? [];
        expect(includes[0]).toBe("src/**");
        const excluded = includes.slice(1).filter((entry) => entry !== ERROR_FILES);
        expect(includes.includes(ERROR_FILES), guard.name).toBe("sparesErrorFiles" in guard);
        for (const entry of excluded) {
          expect(entry, "an exclusion names one file, never a glob").toMatch(
            /^!src\/[^*?{}[\]]+\.ts$/
          );
        }
        expect(excluded, "sorted").toEqual([...excluded].sort());
        expect(new Set(excluded).size, "unique").toBe(excluded.length);
      });
    });
  }
});

describe("the size baselines only shrink", () => {
  let measured: ReadonlyMap<string, string[]>;
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "aidd-size-guards-"));
    cpSync(join(CLI_ROOT, "src"), join(dir, "src"), { recursive: true });
    cpSync(join(CLI_ROOT, "biome-plugins"), join(dir, "biome-plugins"), { recursive: true });
    const found = new Map<string, string[]>();
    for (const guard of GUARDS) {
      const base = { vcs: { enabled: false }, formatter: { enabled: false } };
      const config =
        guard.kind === "rule"
          ? {
              ...base,
              assist: { enabled: false },
              linter: {
                rules: {
                  preset: "none",
                  [guard.group]: {
                    [guard.rule]: carrierOf(guard).linter?.rules?.[guard.group]?.[guard.rule],
                  },
                },
              },
            }
          : { ...base, assist: { enabled: false }, plugins: [pluginPath(guard.file)] };
      writeFileSync(join(dir, "biome.json"), JSON.stringify(config));
      const id = findingId(guard);
      const files = biomeFindings(dir)
        .filter((finding) => finding.endsWith(`:${id}`))
        .map((finding) => finding.slice(0, finding.lastIndexOf(":")))
        .filter((file) => !("sparesErrorFiles" in guard) || !file.endsWith(".error.ts"));
      found.set(guard.name, [...new Set(files)].sort());
    }
    measured = found;
  }, 60_000);

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  for (const guard of GUARDS) {
    it(`lists exactly the files that still break ${guard.name}`, () => {
      const { added, fixed } = expectRatchet(measured.get(guard.name) ?? [], baselineOf(guard));
      expect(added, `new violator of ${guard.name}: fix it, never list it`).toEqual([]);
      expect(
        fixed,
        `no longer violates ${guard.name}: remove it from its override in biome.json`
      ).toEqual([]);
    });
  }

  it("names a baseline entry whose file no longer violates", () => {
    expect(expectRatchet(["src/a.ts"], ["src/a.ts", "src/gone.ts"]).fixed).toEqual(["src/gone.ts"]);
  });
});

const ALL_IDS = new Set(GUARDS.map(findingId));

describe("the size guards bite", () => {
  let planted: string;
  let findings: string[];
  const baselinePath = "src/kernel/baselined.ts";

  const sizeFindings = (prefix: string): string[] =>
    findings.filter(
      (finding) =>
        finding.startsWith(prefix) && ALL_IDS.has(finding.slice(finding.lastIndexOf(":") + 1))
    );

  beforeAll(() => {
    planted = mkdtempSync(join(tmpdir(), "aidd-size-guards-bite-"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(planted, "biome-plugins"), { recursive: true });
    mkdirSync(join(planted, "src/kernel"), { recursive: true });
    mkdirSync(join(planted, "tests/kernel"), { recursive: true });

    const files: Record<string, string> = {
      "src/kernel/long-function.ts": longFunction("sixty", 60),
      "src/kernel/tangled.ts": tangled("tangle"),
      "src/kernel/two-classes.ts": twoClasses(""),
      "src/kernel/long-file.ts": constants(420, "v"),
      "src/kernel/two-classes.error.ts": twoClasses("Errors"),
      "src/kernel/long-file.error.ts": constants(420, "e"),
      "src/kernel/tangled.error.ts": tangled("tangleErrors"),
      "src/kernel/four-params.ts": fourParams(""),
      "src/kernel/at-limit-function.ts": `${longFunction("fifty", 48)}export const one = (): number => 1;\nexport const two = (): number => 2;\n`,
      "src/kernel/at-limit-file.ts": constants(400, "w"),
      "src/kernel/at-limit-complexity.ts": branches("fifteen", 15),
      "src/kernel/over-limit-function.ts": longFunction("fiftyOne", 49),
      "src/kernel/over-limit-file.ts": constants(401, "x"),
      "src/kernel/over-limit-complexity.ts": branches("sixteen", 16),
      "src/kernel/at-limit-params.ts":
        "export function three(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n",
      "tests/kernel/oversized.ts": [
        longFunction("sixty", 60),
        tangled("tangle"),
        twoClasses("Tests"),
        constants(420, "t"),
        fourParams("Tests"),
      ].join("\n"),
    };
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(planted, path), content);
    }

    const config = structuredClone(biomeConfig());
    for (const o of config.overrides ?? []) {
      if (o.plugins?.includes(pluginPath("max-function-params.grit")))
        o.includes?.push(`!${baselinePath}`);
    }
    writeFileSync(join(planted, "biome.json"), JSON.stringify(config));
    writeFileSync(join(planted, baselinePath), fourParams("Baseline"));
    findings = biomeFindings(planted);
  }, 60_000);

  afterAll(() => {
    rmSync(planted, { recursive: true, force: true });
  });

  it("flags each planted violator for its own guard", () => {
    const expected: Record<string, string> = {
      "src/kernel/long-function.ts": "lint/complexity/noExcessiveLinesPerFunction",
      "src/kernel/tangled.ts": "lint/complexity/noExcessiveCognitiveComplexity",
      "src/kernel/two-classes.ts": "lint/style/noExcessiveClassesPerFile",
      "src/kernel/long-file.ts": "lint/style/noExcessiveLinesPerFile",
      "src/kernel/four-params.ts": "plugin",
    };
    for (const [file, id] of Object.entries(expected)) {
      expect(findings, `${file} must yield ${id}: ${findings.join(", ")}`).toContain(
        `${file}:${id}`
      );
      expect([...new Set(sizeFindings(file).map((f) => f.slice(f.lastIndexOf(":") + 1)))]).toEqual([
        id,
      ]);
    }
  });

  it("flags one step past each limit, for its own guard", () => {
    const expected: Record<string, string> = {
      "src/kernel/over-limit-function.ts": "lint/complexity/noExcessiveLinesPerFunction",
      "src/kernel/over-limit-file.ts": "lint/style/noExcessiveLinesPerFile",
      "src/kernel/over-limit-complexity.ts": "lint/complexity/noExcessiveCognitiveComplexity",
    };
    for (const [file, id] of Object.entries(expected)) {
      expect(findings, `${file} must yield ${id}`).toContain(`${file}:${id}`);
    }
  });

  it("counts a function, an arrow, a method and a signature, four times over", () => {
    expect(
      findings.filter((finding) => finding === "src/kernel/four-params.ts:plugin")
    ).toHaveLength(4);
  });

  it("flags nothing at the limit", () => {
    expect(sizeFindings("src/kernel/at-limit")).toEqual([]);
  });

  it("spares an error file the class and line caps, and no other guard", () => {
    expect(sizeFindings("src/kernel/two-classes.error.ts")).toEqual([]);
    expect(sizeFindings("src/kernel/long-file.error.ts")).toEqual([]);
    expect(sizeFindings("src/kernel/tangled.error.ts")).toHaveLength(1);
  });

  it("applies none of the six under tests/", () => {
    expect(sizeFindings("tests/")).toEqual([]);
  });

  it("lets a baseline file through, and no other file", () => {
    expect(sizeFindings(baselinePath)).toEqual([]);
  });
});
