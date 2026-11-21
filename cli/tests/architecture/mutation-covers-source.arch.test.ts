/**
 * A file escaping mutation is silent: the score does not drop, because the mutants that would
 * have died were never generated. `mutation-scopes.json` declares the globs, the floor each
 * scope must hold, and what is left out, so a directory belonging to neither fails by name.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scopesToRun } from "../../scripts/mutation-scopes-to-run.mjs";
import { strykerArgs } from "../../scripts/run-mutation.mjs";
import { wireTools } from "../../src/composition/tools.js";
import { matchesGlob, REPO_ROOT, read, sourceFiles } from "./source-graph.js";

interface Scope {
  readonly mutate: string | readonly string[];
  readonly break?: number;
  readonly tests?: readonly string[];
  readonly harnessOnly?: boolean;
}

interface ScopeDeclaration {
  readonly scopes: Readonly<Record<string, Scope>>;
  readonly excluded: Readonly<Record<string, string>>;
}

function declaration(): ScopeDeclaration {
  const parsed = JSON.parse(read("mutation-scopes.json")) as ScopeDeclaration;
  return parsed;
}

function packageScripts(): string[] {
  const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  return Object.keys(scripts);
}

function scopeMatches(mutate: Scope["mutate"], path: string): boolean {
  const globs = [mutate].flat();
  return (
    globs.some((glob) => !glob.startsWith("!") && matchesGlob(glob, path)) &&
    !globs.some((glob) => glob.startsWith("!") && matchesGlob(glob.slice(1), path))
  );
}

function isCovered(path: string, { scopes, excluded }: ScopeDeclaration): boolean {
  return (
    Object.values(scopes).some((scope) => scopeMatches(scope.mutate, path)) ||
    Object.keys(excluded).some((glob) => matchesGlob(glob, path))
  );
}

function fixtureFiles(): string[] {
  return readdirSync(join(REPO_ROOT, "cli/tests/fixtures"), { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => `tests/fixtures/${entry.replaceAll("\\", "/")}`);
}

describe("mutation covers every source file", () => {
  it("no file under src/ falls outside both the scopes and the exclusions", () => {
    const declared = declaration();
    const uncovered = sourceFiles().filter((file) => !isCovered(file, declared));

    expect(
      uncovered,
      "neither mutated nor excluded — add it to a scope in mutation-scopes.json, or exclude it with the reason"
    ).toEqual([]);
  });

  it("every exclusion carries a reason, and every scope matches something", () => {
    const { scopes, excluded } = declaration();
    const files = sourceFiles();

    for (const [glob, reason] of Object.entries(excluded)) {
      expect(reason.length, `${glob} is excluded with no reason given`).toBeGreaterThan(40);
      expect(
        files.some((file) => matchesGlob(glob, file)),
        `${glob} excludes nothing — the directory it names is gone`
      ).toBe(true);
    }
    for (const [name, { mutate }] of Object.entries(scopes)) {
      expect(
        [...files, ...fixtureFiles()].some((file) => scopeMatches(mutate, file)),
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

  it("only telemetry, shared and the canary hold a blocking floor", () => {
    const floored = Object.entries(declaration().scopes)
      .filter(([, scope]) => scope.break !== undefined)
      .map(([name]) => name);
    expect(floored.sort()).toEqual(["canary", "shared", "telemetry"]);
    for (const name of floored) {
      const floor = declaration().scopes[name]?.break;
      expect(
        Number.isInteger(floor) && (floor ?? 0) > 0 && (floor ?? 0) <= 100,
        `scope "${name}" declares an invalid floor`
      ).toBe(true);
    }
  });

  it("package.json runs every scope, and nothing it does not", () => {
    const scripted = packageScripts()
      .filter((name) => name.startsWith("test:mutation:"))
      .map((name) => name.slice("test:mutation:".length));

    expect(scripted.sort()).toEqual(Object.keys(declaration().scopes).sort());
  });

  it("no other file lists what mutation covers", () => {
    const stryker = JSON.parse(read("stryker.conf.json")) as Record<string, unknown>;
    expect("mutate" in stryker, "stryker.conf.json declares its own mutate again").toBe(false);
  });
});

describe("every AI tool is mutated in a scope of its own", () => {
  const aiIds = () => [...wireTools().idsInCanonicalOrder("ai")].sort();
  const profileFolder = (id: string) => `src/contexts/tools/domain/profiles/${id}/**/*.ts`;

  it("declares one tools-<id> scope per registered AI tool, each over its profile folder", () => {
    const { scopes } = declaration();
    const scoped = Object.keys(scopes)
      .filter((name) => name.startsWith("tools-"))
      .map((name) => name.slice("tools-".length));

    expect(scoped.sort()).toEqual(aiIds());
    for (const id of aiIds()) expect(scopes[`tools-${id}`]?.mutate).toBe(profileFolder(id));
  });

  it("carves exactly those profile folders out of the tools scope", () => {
    const negated = [declaration().scopes.tools?.mutate ?? []]
      .flat()
      .filter((glob) => glob.startsWith("!src/contexts/tools/domain/profiles/"))
      .map((glob) => glob.slice(1));

    expect(negated.sort()).toEqual(aiIds().map(profileFolder));
  });

  it("scripts test:mutation:tools-<id> for each, and for no other tool", () => {
    const scripted = packageScripts()
      .filter((name) => name.startsWith("test:mutation:tools-"))
      .map((name) => name.slice("test:mutation:tools-".length));

    expect(scripted.sort()).toEqual(aiIds());
  });
});

describe("the guard itself", () => {
  const scopes = {
    shared: { mutate: "src/shared/**/*.ts", break: 70 },
    tools: { mutate: "src/contexts/tools/**/*.ts", break: 60 },
  };

  it("matches a path inside a glob and rejects one outside it", () => {
    expect(matchesGlob("src/shared/**/*.ts", "src/shared/ports/logger.ts")).toBe(true);
    expect(matchesGlob("src/shared/**/*.ts", "src/shared/domain/tool.ts")).toBe(true);
    expect(matchesGlob("src/shared/**/*.ts", "src/contexts/tools/domain/registry.ts")).toBe(false);
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
      scopeMatches(
        split.tools.mutate,
        "src/contexts/tools/domain/profiles/claude/claude.profile.ts"
      )
    ).toBe(false);
    expect(
      scopeMatches(
        split.profiles.mutate,
        "src/contexts/tools/domain/profiles/claude/claude.profile.ts"
      )
    ).toBe(true);
    expect(strykerArgs("tools", split)).toContain(
      "src/contexts/tools/**/*.ts,!src/contexts/tools/domain/profiles/**/*.ts"
    );
    expect(
      scopesToRun(["cli/src/contexts/tools/domain/profiles/claude/claude.profile.ts"], split).sort()
    ).toEqual(["profiles", "tools"]);
  });

  it("reports a file no scope and no exclusion names, and clears one a scope covers", () => {
    const declared = { scopes, excluded: { "src/cli.ts": "the entry point" } };
    expect(isCovered("src/shared/domain/paths.ts", declared)).toBe(true);
    expect(isCovered("src/cli.ts", declared)).toBe(true);
    expect(isCovered("src/contexts/installation/domain/manifest.ts", declared)).toBe(false);
  });
});
