/**
 * Six size limits live in biome, each at `error` on `src/**` with the files that exceed it today
 * listed as negated includes of its own override. Biome cannot say "this list only shrinks", and
 * a limit it silently stops applying is invisible, so this suite pins each carrier, measures
 * every guard with biome itself against its baseline, and plants a tree to watch each one bite.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { biomeFindings, CLI_ROOT, expectRatchet, read } from "./helpers.js";

type Guard =
  | {
      readonly name: string;
      readonly kind: "rule";
      readonly group: string;
      readonly rule: string;
      readonly options: Readonly<Record<string, unknown>>;
    }
  | { readonly name: string; readonly kind: "plugin"; readonly file: string };

const GUARDS: readonly Guard[] = [
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
  },
  {
    name: "file length",
    kind: "rule",
    group: "style",
    rule: "noExcessiveLinesPerFile",
    options: { maxLines: 400, skipBlankLines: true },
  },
  { name: "function parameters", kind: "plugin", file: "max-function-params.grit" },
  { name: "constructor parameters", kind: "plugin", file: "max-constructor-params.grit" },
];

/**
 * Entries each guard's baseline holds today. Lowered when an entry leaves, never raised: a new
 * violator is fixed, not listed.
 */
const MAX_BASELINE: Readonly<Record<string, number>> = {
  "function length": 20,
  "cognitive complexity": 32,
  "one class per file": 9,
  "file length": 9,
  "function parameters": 94,
  "constructor parameters": 21,
};

interface Override {
  readonly includes?: readonly string[];
  readonly plugins?: readonly string[];
  readonly linter?: {
    readonly rules?: Record<string, Record<string, { level?: string; options?: unknown }>>;
  };
}

const overrides = (): readonly Override[] =>
  (JSON.parse(read("biome.json")) as { overrides?: Override[] }).overrides ?? [];

const pluginPath = (file: string): string => `./biome-plugins/${file}`;

function carriersOf(guard: Guard): Override[] {
  return overrides().filter((o) =>
    guard.kind === "rule"
      ? o.linter?.rules?.[guard.group]?.[guard.rule] !== undefined
      : o.plugins?.includes(pluginPath(guard.file))
  );
}

function carrierOf(guard: Guard): Override {
  const [carrier] = carriersOf(guard);
  if (carrier === undefined) throw new Error(`no override carries ${guard.name}`);
  return carrier;
}

/** The files a guard's override excludes: its baseline. */
function baselineOf(guard: Guard): string[] {
  return (carrierOf(guard).includes ?? [])
    .slice(1)
    .map((entry) => entry.slice(1))
    .sort();
}

/** The finding id biome prints for a guard: a rule's path, or `plugin`. */
const findingId = (guard: Guard): string =>
  guard.kind === "rule" ? `lint/${guard.group}/${guard.rule}` : "plugin";

describe("biome carries the code-size guards", () => {
  for (const guard of GUARDS) {
    describe(guard.name, () => {
      it("is carried by exactly one override, and that override carries nothing else", () => {
        const carriers = carriersOf(guard);
        expect(carriers, `${guard.name} must sit in exactly one override`).toHaveLength(1);
        const carrier = carriers[0] as Override;

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

      it("lists exactly as many files as its ceiling", () => {
        const ceiling = MAX_BASELINE[guard.name] as number;
        expect(
          baselineOf(guard).length,
          `${guard.name} baseline must hold ${ceiling} files: a new violator is fixed, never listed; a fixed file lowers the ceiling`
        ).toBe(ceiling);
      });

      it("applies to src/** and excludes exact, sorted, unique files only", () => {
        const includes = carrierOf(guard).includes ?? [];
        expect(includes[0]).toBe("src/**");
        const excluded = includes.slice(1);
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

describe("the baseline only shrinks", () => {
  let measured: ReadonlyMap<string, string[]>;
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "aidd-code-size-"));
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
        .map((finding) => finding.slice(0, finding.lastIndexOf(":")));
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

const lines = (count: number, line: (index: number) => string): string =>
  Array.from({ length: count }, (_, index) => line(index)).join("\n");

const longFunction = (name: string, body: number): string =>
  `export function ${name}(): number {\n  let n = 0;\n${lines(body, () => "  n += 1;")}\n  return n;\n}\n`;

const tangled = (
  name: string
): string => `export function ${name}(items: number[][], flag: boolean): number {
  let total = 0;
  for (const row of items) {
    for (const cell of row) {
      if (cell > 0 && flag) {
        for (let i = 0; i < cell; i++) {
          if (i % 2 === 0 || flag) {
            total += i;
          } else if (i > 3 && cell > 4) {
            total -= i;
          }
        }
      }
    }
  }
  return total;
}
`;

const branches = (name: string, count: number): string =>
  `export function ${name}(n: number): number {\n  let total = 0;\n${lines(count, (index) => `  if (n > ${index}) total += 1;`)}\n  return total;\n}\n`;

const twoClasses = (suffix: string): string =>
  `export class First${suffix} {}\nexport class Second${suffix} {}\n`;

const constants = (count: number, prefix: string): string =>
  `${lines(count, (index) => `export const ${prefix}${index} = ${index};`)}\n`;

const fourParams = (
  suffix: string
): string => `export function four${suffix}(a: number, b: number, c: number, d: number): number {
  return a + b + c + d;
}
export const arrow${suffix} = (a: number, b: number, c: number, d: number): number => a + b + c + d;
export class Method${suffix} {
  sum(a: number, b: number, c: number, d: number): number {
    return a + b + c + d;
  }
}
export interface Port${suffix} {
  sum(a: number, b: number, c: number, d: number): number;
}
`;

const constructorOf = (count: number, name: string): string =>
  `export class ${name} {\n  constructor(\n${lines(count, (index) => `    private readonly dep${index}: number,`)}\n  ) {}\n}\n`;

const ALL_IDS = new Set(GUARDS.map(findingId));

describe("the guard itself", () => {
  let planted: string;
  let findings: string[];
  let baselinePath: string;

  const sizeFindings = (prefix: string): string[] =>
    findings.filter(
      (finding) =>
        finding.startsWith(prefix) && ALL_IDS.has(finding.slice(finding.lastIndexOf(":") + 1))
    );

  beforeAll(() => {
    planted = mkdtempSync(join(tmpdir(), "aidd-code-size-bite-"));
    cpSync(join(CLI_ROOT, "biome.json"), join(planted, "biome.json"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(planted, "biome-plugins"), { recursive: true });
    mkdirSync(join(planted, "src/kernel"), { recursive: true });
    mkdirSync(join(planted, "tests/kernel"), { recursive: true });

    const files: Record<string, string> = {
      "src/kernel/long-function.ts": longFunction("sixty", 60),
      "src/kernel/tangled.ts": tangled("tangle"),
      "src/kernel/two-classes.ts": twoClasses(""),
      "src/kernel/long-file.ts": constants(420, "v"),
      "src/kernel/four-params.ts": fourParams(""),
      "src/kernel/six-dependencies.ts": constructorOf(6, "Six"),
      "src/kernel/at-limit-function.ts": `${longFunction("fifty", 48)}export const one = (): number => 1;\nexport const two = (): number => 2;\n`,
      "src/kernel/at-limit-class.ts": constructorOf(5, "Five"),
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
        constructorOf(6, "SixTests"),
      ].join("\n"),
    };
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(planted, path), content);
    }

    baselinePath = baselineOf(
      GUARDS.find((g) => g.name === "function parameters") as Guard
    )[0] as string;
    mkdirSync(join(planted, dirname(baselinePath)), { recursive: true });
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
      "src/kernel/six-dependencies.ts": "plugin",
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

  it("flags a six-dependency constructor once", () => {
    expect(
      findings.filter((finding) => finding === "src/kernel/six-dependencies.ts:plugin")
    ).toHaveLength(1);
  });

  it("counts a function, an arrow, a method and a signature, four times over", () => {
    expect(
      findings.filter((finding) => finding === "src/kernel/four-params.ts:plugin")
    ).toHaveLength(4);
  });

  it("flags nothing at the limit", () => {
    expect(sizeFindings("src/kernel/at-limit")).toEqual([]);
  });

  it("applies none of the six under tests/", () => {
    expect(sizeFindings("tests/")).toEqual([]);
  });

  it("lets a baseline file through, and no other file", () => {
    expect(sizeFindings(baselinePath)).toEqual([]);
  });
});
