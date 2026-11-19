/**
 * A file escaping mutation is silent: the score does not drop, because the mutants that would
 * have died were never generated. `mutation-scopes.json` declares the globs and the floor each
 * scope must hold, so a domain file belonging to no scope fails by name.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS, scopesToRun } from "../../scripts/mutation-scopes-to-run.mjs";
import {
  breakVerdict,
  canarySelectionVerdict,
  changedArgs,
  changedRanges,
  pruneIncremental,
  scoreOf,
  strykerArgs,
  survivorsOf,
} from "../../scripts/run-mutation.mjs";
import { matchesGlob, REPO_ROOT, read, sourceFiles } from "./helpers.js";

interface Scope {
  readonly mutate: string | readonly string[];
  readonly break: number;
}

interface ScopeDeclaration {
  readonly scopes: Readonly<Record<string, Scope>>;
}

function declaration(): ScopeDeclaration {
  return JSON.parse(read("mutation-scopes.json")) as ScopeDeclaration;
}

function scopeMatches(mutate: Scope["mutate"], path: string): boolean {
  const globs = [mutate].flat();
  return (
    globs.some((glob) => !glob.startsWith("!") && matchesGlob(glob, path)) &&
    !globs.some((glob) => glob.startsWith("!") && matchesGlob(glob.slice(1), path))
  );
}

/** What mutation covers: the kernel and every context's domain, bar the static tool profiles. */
function isDomain(path: string): boolean {
  return (
    (matchesGlob("src/kernel/**/*.ts", path) ||
      matchesGlob("src/contexts/*/domain/**/*.ts", path)) &&
    !matchesGlob("src/contexts/tools/domain/profiles/**/*.ts", path)
  );
}

function isCovered(path: string, { scopes }: ScopeDeclaration): boolean {
  return Object.values(scopes).some((scope) => scopeMatches(scope.mutate, path));
}

function fixtureFiles(): string[] {
  return readdirSync(join(REPO_ROOT, "cli/tests/fixtures"), { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => `tests/fixtures/${entry.replaceAll("\\", "/")}`);
}

describe("mutation covers every domain file", () => {
  it("no domain file falls outside the scopes", () => {
    const declared = declaration();
    const uncovered = sourceFiles().filter((file) => isDomain(file) && !isCovered(file, declared));

    expect(
      uncovered,
      "a domain file no scope mutates — add it to a scope in mutation-scopes.json"
    ).toEqual([]);
  });

  it("every scope matches something", () => {
    const files = [...sourceFiles(), ...fixtureFiles()];

    for (const [name, { mutate }] of Object.entries(declaration().scopes)) {
      expect(
        files.some((file) => scopeMatches(mutate, file)),
        `scope "${name}" (${mutate}) matches no file — it would score an empty set`
      ).toBe(true);
    }
  });

  it("no source file is mutated by two scopes, so a mutant is measured once", () => {
    const { scopes } = declaration();
    const twice = sourceFiles().filter(
      (file) => Object.values(scopes).filter((scope) => scopeMatches(scope.mutate, file)).length > 1
    );
    expect(twice, "narrow one scope with a ! glob").toEqual([]);
  });

  it("no source scope mutates outside the domain", () => {
    const outside = Object.entries(declaration().scopes).flatMap(([name, scope]) =>
      sourceFiles()
        .filter((file) => scopeMatches(scope.mutate, file) && !isDomain(file))
        .map((file) => `${name}: ${file}`)
    );
    expect(outside, "mutation covers the domain only, per the testing policy").toEqual([]);
  });

  it("every scope declares the floor its score must hold", () => {
    for (const [name, scope] of Object.entries(declaration().scopes)) {
      expect(
        Number.isInteger(scope.break) && scope.break > 0 && scope.break <= 100,
        `scope "${name}" declares no break floor — a run cannot fail`
      ).toBe(true);
    }
  });

  it("package.json runs every scope, and nothing it does not", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const scripted = Object.keys(scripts)
      .filter((name) => name.startsWith("test:mutation:"))
      .map((name) => name.slice("test:mutation:".length));

    expect(scripted.sort()).toEqual(Object.keys(declaration().scopes).sort());
  });

  it("no other file lists what mutation covers", () => {
    const stryker = JSON.parse(read("stryker.conf.json")) as Record<string, unknown>;
    expect("mutate" in stryker, "stryker.conf.json declares its own mutate again").toBe(false);
  });
});

describe("the guard itself", () => {
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

  const scopes = {
    kernel: { mutate: "src/kernel/**/*.ts", break: 70 },
    tools: { mutate: "src/contexts/tools/**/*.ts", break: 60 },
  };

  it("matches a path inside a glob and rejects one outside it", () => {
    expect(matchesGlob("src/kernel/**/*.ts", "src/kernel/ports/logger.ts")).toBe(true);
    expect(matchesGlob("src/kernel/**/*.ts", "src/kernel/tool.ts")).toBe(true);
    expect(matchesGlob("src/kernel/**/*.ts", "src/contexts/tools/domain/registry.ts")).toBe(false);
    expect(matchesGlob("src/cli.ts", "src/cli.ts")).toBe(true);
    expect(matchesGlob("src/cli.ts", "src/clints.ts")).toBe(false);
  });

  it("lets a ! glob carve a file out of a scope, and joins a list for stryker", () => {
    const split = {
      tools: {
        mutate: ["src/contexts/tools/**/*.ts", "!src/contexts/tools/domain/profiles/**/*.ts"],
        break: 1,
      },
      profiles: { mutate: "src/contexts/tools/domain/profiles/**/*.ts", break: 1 },
    };
    expect(scopeMatches(split.tools.mutate, "src/contexts/tools/domain/registry.ts")).toBe(true);
    expect(
      scopeMatches(split.tools.mutate, "src/contexts/tools/domain/profiles/claude/profile.ts")
    ).toBe(false);
    expect(
      scopeMatches(split.profiles.mutate, "src/contexts/tools/domain/profiles/claude/profile.ts")
    ).toBe(true);
    expect(strykerArgs("tools", split)).toContain(
      "src/contexts/tools/**/*.ts,!src/contexts/tools/domain/profiles/**/*.ts"
    );
    expect(
      scopesToRun(["cli/src/contexts/tools/domain/profiles/claude/profile.ts"], split)
    ).toEqual(["profiles"]);
    expect(scopesToRun(["cli/src/contexts/tools/domain/registry.ts"], split)).toEqual(["tools"]);
  });

  it("runs no scope for a change outside the domain, and the canary for its own tests", () => {
    const declared = declaration().scopes;
    expect(
      scopesToRun(
        [
          "cli/src/contexts/tools/infrastructure/executable-on-path.ts",
          "cli/src/contexts/framework/application/setup-use-case.ts",
          "cli/tests/presentation/commands/auth-wiring.integration.test.ts",
        ],
        declared
      )
    ).toEqual([]);
    expect(
      scopesToRun(["cli/tests/fixtures/stryker-canary/settings.unit.test.ts"], declared)
    ).toEqual(["canary"]);
  });

  it("reports a domain file no scope names, and clears one a scope covers", () => {
    const declared = { scopes };
    expect(isCovered("src/kernel/paths.ts", declared)).toBe(true);
    expect(isCovered("src/contexts/framework/domain/manifest.ts", declared)).toBe(false);
  });

  it("holds the kernel and each context's domain, never a tool profile or another layer", () => {
    expect(isDomain("src/kernel/paths.ts")).toBe(true);
    expect(isDomain("src/contexts/framework/domain/manifest.ts")).toBe(true);
    expect(isDomain("src/contexts/tools/domain/registry.ts")).toBe(true);
    expect(isDomain("src/contexts/tools/domain/profiles/claude/profile.ts")).toBe(false);
    expect(isDomain("src/contexts/framework/application/setup-use-case.ts")).toBe(false);
    expect(isDomain("src/cli.ts")).toBe(false);
  });

  it("gives each scope its own glob and incremental file, and refuses a scope nobody declared", () => {
    expect(strykerArgs("kernel", scopes)).toEqual([
      "run",
      "--mutate",
      "src/kernel/**/*.ts",
      "--incremental",
      "--incrementalFile",
      "reports/mutation/kernel/incremental.json",
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

  it("runs the scopes a change touches, through source or mirrored tests, and all of them for the harness or a helper", () => {
    expect(scopesToRun(["cli/src/kernel/paths.ts"], scopes)).toEqual(["kernel"]);
    expect(
      scopesToRun(["cli/tests/contexts/tools/domain/registry-conformance.unit.test.ts"], scopes)
    ).toEqual(["tools"]);
    expect(scopesToRun(["README.md"], scopes)).toEqual([]);
    expect(scopesToRun(["cli/tests/helpers/repository-root.ts"], scopes)).toEqual([
      "kernel",
      "tools",
    ]);
    expect(scopesToRun([HARNESS[0]], scopes)).toEqual(["kernel", "tools"]);
    expect(scopesToRun([], scopes, { all: true })).toEqual(["kernel", "tools"]);
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

  it("fails a score under the floor and passes one on it", () => {
    expect(breakVerdict(69.9, scopes.kernel)).toMatch(/below the 70/);
    expect(breakVerdict(70, scopes.kernel)).toBeNull();
  });
});
