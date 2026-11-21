/**
 * Repository hygiene: the wiring around the package that no other test owns.
 *
 * - Git hooks are installed from the repository root only: a hook in a worktree runs lefthook with
 *   GIT_DIR set, and it takes `cli/` for the root.
 * - Every vitest project that runs the source sees a throwaway profile, in the suite and in a
 *   mutation run.
 * - A rule loads only for the files its `paths:` globs match, so a glob left behind by a move
 *   silently turns the rule off. Every glob under `.claude/rules` must match at least one file.
 * - Architecture paths select the same files on every platform.
 * - No source comment holds an em dash: one printed to a user is a string and stays, one in a
 *   comment is prose that drifted from the writing rule.
 * - No test resolves a path into the shared `dist/`: the build cleans it, so a second concurrent
 *   run rewrites the binary a first run is reading. `tests/setup/global-setup.ts` builds a private
 *   binary per run.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../vitest.config.js";
import mutation from "../../vitest.mutation.config.js";
import { present } from "../shared/testing/present.builder.js";
import { commentRanges } from "./comment-ranges.js";
import {
  CLI_ROOT,
  canonicalPath,
  contextOf,
  importersByFile,
  matchesGlob,
  pluginReadmes,
  read,
  resolveImportTarget,
  sourceFiles,
} from "./source-graph.js";

describe("git hooks are installed from the repository root only", () => {
  it("no script of this package calls lefthook: a hook in a worktree runs it with GIT_DIR set, and it takes cli/ for the root", () => {
    const manifest: { scripts: Record<string, string> } = JSON.parse(
      readFileSync(join(CLI_ROOT, "package.json"), "utf8")
    );
    const { scripts } = manifest;
    expect(Object.entries(scripts).filter(([, command]) => /\blefthook\b/.test(command))).toEqual(
      []
    );
  });
});

const SETUP = "./tests/setup/throwaway-profile.ts";
const RUNS_SOURCE = ["unit", "contract", "integration"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function projectsRunningSource(
  projects: readonly unknown[]
): { name: string; globalSetup: unknown }[] {
  return projects.flatMap((project) => {
    const test = isRecord(project) ? project.test : undefined;
    return isRecord(test) && typeof test.name === "string" && RUNS_SOURCE.includes(test.name)
      ? [{ name: test.name, globalSetup: test.globalSetup }]
      : [];
  });
}

describe("every project that runs the source sees a throwaway profile", () => {
  it.each([
    ["the suite", projectsRunningSource(config.test?.projects ?? [])],
    ["a mutation run", projectsRunningSource(mutation.test?.projects ?? [])],
  ])(
    "%s declares the throwaway-profile setup on its unit, contract and integration projects",
    (_run, projects) => {
      expect(projects.map((p) => p.name).sort()).toStrictEqual(["contract", "integration", "unit"]);
      for (const project of projects) expect(project.globalSetup, project.name).toContain(SETUP);
    }
  );
});

const RULES_DIR = ".claude/rules";

/** The globs a rule's frontmatter lists under `paths:`; none when it has no such list. */
function pathGlobs(rule: string): string[] {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(rule)?.[1] ?? "";
  const list = /^paths:\n((?:\s+- .*\n?)*)/m.exec(frontmatter)?.[1] ?? "";
  return [...list.matchAll(/^\s+- "?([^"\n]+?)"?\s*$/gm)].map((match) => present(match[1]));
}

/** `matchesGlob` reads `/**\/` as any depth; a trailing `/**` means every file below. */
function reaches(glob: string, file: string): boolean {
  return matchesGlob(glob.replace(/\/\*\*$/, "/**/*"), file);
}

function filesUnder(root: string): string[] {
  return readdirSync(join(CLI_ROOT, root), { recursive: true, encoding: "utf8" }).map((entry) =>
    canonicalPath(join(root, entry))
  );
}

function ruleFiles(): string[] {
  return filesUnder(RULES_DIR).filter((file) => file.endsWith(".md"));
}

/** The globs of one rule that match none of `files`. */
function deadGlobs(rule: string, files: readonly string[]): string[] {
  return pathGlobs(rule).filter((glob) => !files.some((file) => reaches(glob, file)));
}

describe("rule paths follow the code", () => {
  it("every paths glob under .claude/rules matches at least one file", () => {
    const tree = new Map<string, string[]>();
    const dead = ruleFiles().flatMap((rule) =>
      pathGlobs(read(rule)).flatMap((glob) => {
        const root = present(glob.split("/")[0]);
        const files = tree.get(root) ?? filesUnder(root);
        tree.set(root, files);
        return files.some((file) => reaches(glob, file)) ? [] : [`${rule}: ${glob}`];
      })
    );
    expect(dead, "glob matching no file: fix or drop it").toEqual([]);
  });

  it("finds rules with globs, so the rule cannot pass by selecting nothing", () => {
    const globs = ruleFiles().flatMap((rule) => pathGlobs(read(rule)));
    expect(globs.length).toBeGreaterThan(0);
  });
});

describe("the rule-paths guard itself", () => {
  const files = ["src/cli.ts", "src/contexts/auth/domain/token.ts", "tests/fixtures/a/b.jsonl"];

  it("flags a glob matching no file and clears one that matches", () => {
    const rule = '---\ndescription: x\npaths:\n  - "src/gone/**/*.ts"\n  - "src/**"\n---\n# R\n';
    expect(deadGlobs(rule, files)).toEqual(["src/gone/**/*.ts"]);
  });

  it("reads a quoted and an unquoted glob, and a rule with no paths", () => {
    expect(pathGlobs('---\npaths:\n  - "a/**"\n  - b/*.ts\n---\n')).toEqual(["a/**", "b/*.ts"]);
    expect(pathGlobs("---\ndescription: x\n---\n")).toEqual([]);
  });

  it("matches every file below a trailing /** and none outside it", () => {
    expect(reaches("tests/fixtures/**", "tests/fixtures/a/b.jsonl")).toBe(true);
    expect(reaches("tests/fixtures/**", "src/cli.ts")).toBe(false);
  });
});

describe("architecture paths select the same files on every platform", () => {
  it.each([
    ["src\\contexts\\tools\\domain\\tool.ts", "tools", "src/contexts/**/*.ts"],
    ["src\\shared\\domain\\errors.ts", "shared", "src/shared/**/*.ts"],
    ["src\\presentation\\commands\\setup.ts", "presentation", "src/presentation/commands/**"],
  ])("selects the explicit backslash path %s", (nativePath, context, glob) => {
    const file = canonicalPath(nativePath);
    expect(contextOf(file)).toBe(context);
    expect(matchesGlob(glob, file)).toBe(true);
    expect(matchesGlob("src/deleted-context/**", file)).toBe(false);
  });

  it.each([
    ["src\\shared\\ports\\file-reader.ts", "../file.js"],
    ["src/shared/ports/file-reader.ts", "..\\file.js"],
    ["src\\runtime\\caller.ts", "@/shared/file.js"],
  ])("resolves %s importing %s to the canonical source key", (file, specifier) => {
    const known = new Set(["src/shared/file.ts"]);
    expect(known.has(resolveImportTarget(file, specifier))).toBe(true);
  });

  it("returns canonical, nonempty source and plugin scopes", () => {
    const files = sourceFiles();
    const readmes = pluginReadmes();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => file.startsWith("src/") && !file.includes("\\"))).toBe(true);
    expect(readmes.length).toBeGreaterThan(0);
    expect(readmes.every((file) => /^plugins\/[^/]+\/README\.md$/.test(file))).toBe(true);
  });

  it("keeps relative-import lookups connected to the source-file keys", () => {
    expect(importersByFile().get("src/shared/domain/file-hash.ts")).toContain(
      "src/shared/ports/file-reader.ts"
    );
  });
});

const EM_DASH = "\u2014";

/** The comments of `source` that hold an em dash. */
function dashedComments(source: string): string[] {
  return commentRanges(source)
    .map(({ start, end }) => source.slice(start, end))
    .filter((comment) => comment.includes(EM_DASH));
}

describe("no source comment holds an em dash", () => {
  it("writes each comment without one", () => {
    const offenders = sourceFiles().filter((file) => dashedComments(read(file)).length > 0);
    expect(offenders, "an em dash in a comment: use a colon, a comma or a hyphen").toEqual([]);
  });
});

describe("the em dash guard itself", () => {
  it("flags a line comment and a block comment holding one", () => {
    expect(dashedComments(`const a = 1; // one ${EM_DASH} two`)).toHaveLength(1);
    expect(dashedComments(`/** one ${EM_DASH} two */\nconst a = 1;`)).toHaveLength(1);
  });

  it("clears an em dash printed by a string or a template literal", () => {
    expect(dashedComments(`const a = "x ${EM_DASH} y";`)).toEqual([]);
    expect(dashedComments(`const a = \`x ${EM_DASH} \${b} ${EM_DASH} y\`;`)).toEqual([]);
  });

  it("reads a // inside a string, a template literal or a regex as text, and the comment after it", () => {
    expect(dashedComments(`const u = "http://a"; // ${EM_DASH}`)).toHaveLength(1);
    expect(dashedComments(`const u = \`http://\${a}/${EM_DASH}\`;`)).toEqual([]);
    expect(dashedComments(`const r = /\\/\\/${EM_DASH}/;`)).toEqual([]);
  });
});

const TESTS_ROOT = join(CLI_ROOT, "tests");

/** `resolve(process.cwd(), "dist...")` or `join(process.cwd(), "dist...")` - the bug. */
const CWD_INTO_DIST = /(?:resolve|join)\(\s*process\.cwd\(\)\s*,\s*["'`]dist(?:\/|["'`])/;

function testFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts")) out.push(full);
    }
  };
  walk(TESTS_ROOT);
  return out;
}

describe("no test resolves a path into the shared dist/ build output", () => {
  it("every file under tests/ reads the e2e run's own binary, not dist/cli.js", () => {
    const violations = testFiles()
      .filter((file) => CWD_INTO_DIST.test(readFileSync(file, "utf8")))
      .map((file) => canonicalPath(relative(CLI_ROOT, file)));

    expect(
      violations,
      "resolves into the shared dist/ - read cliPath() from tests/shared/testing/cli-sandbox.builder.ts instead"
    ).toEqual([]);
  });
});

describe("the shared binary guard itself", () => {
  it("flags process.cwd() resolved into dist/, not an unrelated temp dist dir", () => {
    // Built from two pieces so this file's own text never carries the literal the rule
    // above forbids, which would trip it on itself.
    const violation = `resolve(process.cwd(), "di${""}st/cli.js")`;
    expect(CWD_INTO_DIST.test(violation)).toBe(true);
    expect(CWD_INTO_DIST.test('join(tempDir, "dist")')).toBe(false);
    expect(CWD_INTO_DIST.test('expect(content).toContain("dist/")')).toBe(false);
  });
});
