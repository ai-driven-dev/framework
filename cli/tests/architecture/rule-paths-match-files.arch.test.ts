/**
 * A rule loads only for the files its `paths:` globs match, so a glob left behind by a move
 * silently turns the rule off. Every glob under `.claude/rules` must match at least one file.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, canonicalPath, matchesGlob, read } from "./helpers.js";
import { present } from "./present.js";

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

describe("the guard itself", () => {
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
