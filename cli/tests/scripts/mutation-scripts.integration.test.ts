/**
 * The mutation scripts, exercised through the same functions the pipeline calls: score, scope
 * selection, shard arguments, incremental carry and the canary verdict. The declaration
 * `mutation-scopes.json` is held against the source by `tests/architecture/mutation-covers-source`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS, scopesToRun } from "../../scripts/mutation-scopes-to-run.mjs";
import {
  breakVerdict,
  canarySelectionVerdict,
  changedArgs,
  changedRanges,
  type MutationScope,
  pruneIncremental,
  scoreOf,
  strykerArgs,
  survivorsOf,
} from "../../scripts/run-mutation.mjs";
import mutationConfig from "../../vitest.mutation.config.js";
import { mutationScopes } from "../shared/testing/json-value.builder.js";
import { REPOSITORY_ROOT } from "../shared/testing/repository-root.builder.js";

const CLI_ROOT = resolve(import.meta.dirname, "..", "..");
const REPO_ROOT = REPOSITORY_ROOT;

function declaration(): { scopes: Readonly<Record<string, MutationScope>> } {
  return { scopes: mutationScopes(readFileSync(join(CLI_ROOT, "mutation-scopes.json"), "utf8")) };
}

describe("the mutation scripts", () => {
  const scopes = {
    shared: { mutate: "src/shared/**/*.ts", break: 70 },
    tools: { mutate: "src/contexts/tools/**/*.ts", break: 60 },
  };

  it("rejects a canary run that skipped its covering test or ran a neighbour", () => {
    const mutant = {
      id: "1",
      status: "Killed",
      coveredBy: ["test-1"],
      killedBy: ["test-1"],
      testsCompleted: 1,
    };
    const report = (override = {}) => ({
      files: { canary: { mutants: [{ ...mutant, ...override }] } },
    });
    expect(canarySelectionVerdict(report())).toBeNull();
    expect(canarySelectionVerdict(report({ testsCompleted: 0 }))).toMatch(/covering test/);
    expect(canarySelectionVerdict(report({ testsCompleted: 2 }))).toMatch(/covering test/);
    expect(canarySelectionVerdict(report({ killedBy: ["test-2"] }))).toMatch(/covering test/);
    expect(canarySelectionVerdict(report({ static: true, coveredBy: [] }))).toBeNull();
  });

  it("gives each scope its own glob and incremental file, and refuses a scope nobody declared", () => {
    expect(strykerArgs("shared", scopes)).toEqual([
      "run",
      "--mutate",
      "src/shared/**/*.ts",
      "--incremental",
      "--incrementalFile",
      "reports/mutation/shared/incremental.json",
    ]);
    expect(strykerArgs("tools", scopes, { force: true })).toContain("--force");
    expect(() => strykerArgs("nowhere", scopes)).toThrow('Unknown scope "nowhere"');
  });

  it("scores detected over detected plus undetected, leaves ignored and errored aside, and an empty report as zero", () => {
    const report = {
      files: {
        "a.ts": {
          mutants: [
            { status: "Killed" },
            { status: "Timeout" },
            { status: "Survived" },
            { status: "NoCoverage" },
            { status: "Ignored" },
            { status: "RuntimeError" },
            { status: "CompileError" },
          ],
        },
      },
    };
    expect(scoreOf(report)).toBe(50);
    expect(scoreOf({ files: {} })).toBe(0);
  });

  it("runs per change only the gated scopes whose source changed, and every scope for a harness file or a full run", () => {
    const mixed = {
      shared: {
        mutate: "src/shared/**/*.ts",
        break: 70,
        tests: ["tests/shared/domain/**", "tests/shared/testing/**"],
      },
      tools: { mutate: "src/contexts/tools/**/*.ts", tests: ["tests/contexts/tools/**"] },
    };
    expect(scopesToRun(["cli/src/shared/domain/paths.ts"], mixed)).toEqual(["shared"]);
    expect(scopesToRun(["cli/src/contexts/tools/domain/marketplace-entry.ts"], mixed)).toEqual([]);
    expect(
      scopesToRun(["cli/tests/contexts/tools/domain/catalog-registered.unit.test.ts"], mixed)
    ).toEqual([]);
    expect(scopesToRun(["README.md"], mixed)).toEqual([]);
    expect(scopesToRun(["cli/tests/golden/testing/expect-golden.builder.ts"], mixed)).toEqual([]);
    expect(scopesToRun(["cli/tests/shared/domain/paths.unit.test.ts"], mixed)).toEqual(["shared"]);
    expect(scopesToRun(["cli/tests/shared/testing/capturing-logger.fake.ts"], mixed)).toEqual([
      "shared",
    ]);
    expect(
      scopesToRun(["cli/tests/shared/infrastructure/asset-loader.unit.test.ts"], mixed)
    ).toEqual([]);
    expect(scopesToRun(["cli/pnpm-lock.yaml", ".github/workflows/cli-ci.yml"], mixed)).toEqual([]);
    for (const file of HARNESS) expect(scopesToRun([file], mixed)).toEqual(["shared", "tools"]);
    expect(scopesToRun([], mixed, { all: true })).toEqual(["shared", "tools"]);
  });

  it("runs a gated scope when its tests or kit change, never a scope with no floor", () => {
    const scopes = declaration().scopes;
    expect(
      scopesToRun(["cli/tests/contexts/telemetry/testing/fake-locator.fake.ts"], scopes)
    ).toEqual(["telemetry"]);
    expect(
      scopesToRun(
        ["cli/tests/presentation/display/telemetry/telemetry-report-display.unit.test.ts"],
        scopes
      )
    ).toEqual(["telemetry"]);
    expect(scopesToRun(["cli/tests/shared/testing/capturing-logger.fake.ts"], scopes)).toEqual([
      "shared",
    ]);
    expect(
      scopesToRun(["cli/tests/contexts/tools/domain/catalog-registered.unit.test.ts"], scopes)
    ).toEqual([]);
    expect(scopesToRun(["cli/tests/golden/testing/expect-golden.builder.ts"], scopes)).toEqual([]);
    for (const [name, scope] of Object.entries(scopes)) {
      for (const glob of scope.tests ?? []) {
        expect(
          existsSync(join(REPO_ROOT, "cli", glob.replace(/\/\*\*.*$/, ""))),
          `${name}: tests glob ${glob} names nothing`
        ).toBe(true);
      }
    }
  });

  it("runs the canary alone for a lockfile change, so a Stryker or Vitest bump cannot skip it", () => {
    const withCanary = {
      shared: { mutate: "src/shared/**/*.ts", break: 70 },
      canary: { mutate: "tests/fixtures/stryker-canary/**/*.ts", break: 100, harnessOnly: true },
    };
    expect(scopesToRun(["cli/pnpm-lock.yaml"], withCanary)).toEqual(["canary"]);
    expect(
      scopesToRun(["cli/pnpm-lock.yaml", "cli/src/shared/domain/paths.ts"], withCanary)
    ).toEqual(["shared", "canary"]);
  });

  it("runs the canary only for a harness file, a lockfile or a full run, never for a change to its fixture", () => {
    const withCanary = {
      shared: { mutate: "src/shared/**/*.ts", break: 70 },
      canary: { mutate: "tests/fixtures/stryker-canary/**/*.ts", break: 100, harnessOnly: true },
    };
    expect(scopesToRun(["cli/tests/fixtures/stryker-canary/settings.ts"], withCanary)).toEqual([]);
    expect(scopesToRun(["cli/vitest.mutation.config.ts"], withCanary)).toEqual([
      "shared",
      "canary",
    ]);
    expect(scopesToRun([], withCanary, { all: true })).toEqual(["shared", "canary"]);
    expect(declaration().scopes.canary?.harnessOnly).toBe(true);
  });

  it("keeps a test that drives the CLI in process out of the worker-thread projects", () => {
    const unit = mutationConfig.test?.projects?.find(
      (project) => typeof project === "object" && "test" in project && project.test?.name === "unit"
    );
    const excluded = typeof unit === "object" && "test" in unit ? unit.test?.exclude : undefined;
    expect(excluded).toContain("tests/presentation/commands/unknown-commands.integration.test.ts");
  });

  it("names a harness of exactly the three files that reshape every scope", () => {
    expect([...HARNESS].sort()).toEqual([
      "cli/mutation-scopes.json",
      "cli/stryker.conf.json",
      "cli/vitest.mutation.config.ts",
    ]);
  });

  it("runs a scope that names a single file when that file changed", () => {
    const single = {
      adapter: {
        mutate: ["src/contexts/telemetry/domain/git-environment.ts"],
        break: 1,
      },
      tools: { mutate: "src/contexts/tools/**/*.ts", break: 1 },
    };
    expect(scopesToRun(["cli/src/contexts/telemetry/domain/git-environment.ts"], single)).toEqual([
      "adapter",
    ]);
    expect(scopesToRun(["cli/src/contexts/telemetry/domain/git-environment.tsx"], single)).toEqual(
      []
    );
  });

  it("names every harness file the tree holds, so a renamed one cannot silently stop counting", () => {
    for (const file of HARNESS) {
      expect(
        existsSync(join(REPO_ROOT, file)),
        `${file} is named in HARNESS but is not there`
      ).toBe(true);
    }
  });

  it("carries only a kill forward, so a test written later reaches what survived, went uncovered or is static", () => {
    const pruned = pruneIncremental({
      files: {
        "a.ts": {
          mutants: [
            { status: "Killed" },
            { status: "Timeout" },
            { status: "Killed", static: true },
            { status: "Survived" },
            { status: "NoCoverage" },
          ],
        },
      },
    });
    expect(pruned.files?.["a.ts"]?.mutants).toEqual([{ status: "Killed" }]);
  });

  it("mutates only the lines a diff adds or changes under src/, never a deletion or another file", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -10,2 +10,3 @@ function a() {",
      "@@ -20 +21 @@ function b() {",
      "@@ -30,4 +31,0 @@ function c() {",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- /dev/null",
      "+++ b/src/b.ts",
      "@@ -0,0 +1,5 @@",
      "diff --git a/README.md b/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
    ].join("\n");
    expect(changedRanges(diff)).toEqual(["src/a.ts:10-12", "src/a.ts:21-21", "src/b.ts:1-5"]);
    expect(changedArgs(["src/a.ts:10-12", "src/b.ts:1-5"])).toEqual([
      "run",
      "--mutate",
      "src/a.ts:10-12,src/b.ts:1-5",
    ]);
  });

  it("names each mutant a test left alive, with its file and line", () => {
    const report = {
      files: {
        "src/a.ts": {
          mutants: [
            { status: "Killed", mutatorName: "BooleanLiteral", location: { start: { line: 3 } } },
            { status: "Survived", mutatorName: "StringLiteral", location: { start: { line: 7 } } },
            {
              status: "NoCoverage",
              mutatorName: "BlockStatement",
              location: { start: { line: 9 } },
            },
          ],
        },
      },
    };
    expect(survivorsOf(report)).toEqual([
      "src/a.ts:7 StringLiteral (Survived)",
      "src/a.ts:9 BlockStatement (NoCoverage)",
    ]);
  });

  it("passes any score for a scope that declares no floor", () => {
    expect(breakVerdict(0, { mutate: "x" })).toBeNull();
  });

  it("fails a score under the floor and passes one on it", () => {
    expect(breakVerdict(69.9, scopes.shared)).toMatch(/below the 70/);
    expect(breakVerdict(70, scopes.shared)).toBeNull();
  });
});
