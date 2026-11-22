/**
 * The rules Biome holds, planted and linted once. A rule Biome silently stops applying is
 * invisible, so each row of `PLANTS` names a file, what it holds, the rule that must fire and how
 * many times; a `times` of 0 is a file the rule must spare, and a file two overrides could both
 * match must draw both diagnostics, since Biome keeps only the last matching override's options.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isRecord, parseJsonRecord } from "../shared/testing/json-value.builder.js";
import { biomeConfig } from "./biome-config.js";
import { PLANTS } from "./biome-plants.js";
import { biomeFindings, CLI_ROOT, read, reportedFile } from "./source-graph.js";

/** The folders that import nothing from the platform or a package but the two modules that
 * hold no I/O. */
const PURE_FOLDERS = [
  "src/contexts/auth/domain/**/*.ts",
  "src/contexts/auth/ports/**/*.ts",
  "src/contexts/auth/contract/**/*.ts",
  "src/contexts/recipes/domain/**/*.ts",
  "src/contexts/recipes/ports/**/*.ts",
  "src/contexts/distribution/domain/**/*.ts",
  "src/contexts/installation/domain/**/*.ts",
  "src/contexts/machine-claims/domain/**/*.ts",
  "src/contexts/telemetry/domain/**/*.ts",
  "src/contexts/translate/domain/**/*.ts",
  "src/shared/domain/**/*.ts",
  "src/shared/ports/**/*.ts",
] as const;
const PURE_BUILTINS: ReadonlySet<string> = new Set(["path", "crypto"]);

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
