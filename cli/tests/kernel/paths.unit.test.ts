import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  legacyRunsDirs,
  marketplaceCacheDir,
  parseBuiltMarketplaceDir,
  parseBuiltMarketplaceDirAtAnyRoot,
  parseUserBuiltMarketplaceDir,
  resolvedRunsDir,
  samePath,
  samePathSegment,
} from "../../src/kernel/paths.js";
import { environmentWithoutGitVariables } from "../../src/runtime/git/git-environment.js";

describe("marketplaceCacheDir()", () => {
  it("nests the marketplace under the project's cache", () => {
    expect(marketplaceCacheDir("/p", "mkt").replace(/\\/g, "/")).toBe(
      "/p/.aidd/cache/marketplaces/mkt"
    );
  });
});

describe("parseBuiltMarketplaceDir()", () => {
  it("is undefined for a path carrying one segment too many", () => {
    expect(parseBuiltMarketplaceDir("/p", "/p/.aidd/cache/built/mkt/claude/extra", "linux")).toBe(
      undefined
    );
  });
});

describe("parseUserBuiltMarketplaceDir()", () => {
  it("tolerates a trailing separator on the path", () => {
    expect(
      parseUserBuiltMarketplaceDir("/cfg", "/cfg/cache/built/1.0.0/mkt/claude/", "linux")
    ).toStrictEqual({
      version: "1.0.0",
      marketplaceName: "mkt",
      target: "claude",
    });
  });
});

describe("parseBuiltMarketplaceDirAtAnyRoot()", () => {
  it("reads back a relative project root of a single segment", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot("p/.aidd/cache/built/mkt/claude", "linux")
    ).toStrictEqual({
      projectRoot: "p",
      marketplaceName: "mkt",
      target: "claude",
    });
  });

  it("is undefined when only part of the marker matches", () => {
    expect(parseBuiltMarketplaceDirAtAnyRoot("/p/.aidd/cache/other/mkt/claude", "linux")).toBe(
      undefined
    );
  });

  it("matches the marker segment by segment, never as one string", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot("/p/.aidd/cache/built/mkt/claude", "linux")
    ).toStrictEqual({
      projectRoot: "/p",
      marketplaceName: "mkt",
      target: "claude",
    });
  });
});

describe("samePathSegment()", () => {
  it("tells two different names apart on win32 too", () => {
    expect(samePathSegment("alpha", "beta", "win32")).toBe(false);
  });
});

describe("samePath()", () => {
  it("calls a realpath answer and a stored path the same directory when only separators differ", () => {
    expect(samePath("/user-cache/built/1.0.0", "\\user-cache\\built\\1.0.0", "win32")).toBe(true);
  });

  it("still tells two different directories apart", () => {
    expect(samePath("/user-cache/built/1.0.0", "\\user-cache\\built\\2.0.0", "win32")).toBe(false);
  });

  it("folds case where the filesystem does, and nowhere else", () => {
    expect(samePath("/Cache/Built", "/cache/built", "win32")).toBe(true);
    expect(samePath("/Cache/Built", "/cache/built", "linux")).toBe(false);
  });

  it("leaves a posix path that legitimately holds a backslash alone on posix", () => {
    expect(samePath("/odd/a", "/odd\\a", "linux")).toBe(false);
  });
});

const gitEnv = environmentWithoutGitVariables(process.env);
const tempRoots: string[] = [];

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", args, { cwd, env: gitEnv });
}

function makeClone(): { r: string; w: string } {
  const root = mkdtempSync(join(tmpdir(), "aidd-common-dir-"));
  tempRoots.push(root);
  const r = join(root, "r");
  const w = join(root, "w");
  mkdirSync(r);
  git(r, ["init", "-q"]);
  git(r, ["-c", "user.email=t@e", "-c", "user.name=t", "commit", "--allow-empty", "-m", "seed"]);
  git(r, ["worktree", "add", "-q", w]);
  return { r, w };
}

function runsUnderGit(repo: string): string {
  return join(realpathSync.native(join(repo, ".git")), "aidd", "runs");
}

afterEach(() => {
  delete process.env.AIDD_RUNS_DIR;
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { recursive: true, force: true });
  }
});

describe("resolvedRunsDir()", () => {
  it("answers <common dir>/aidd/runs from the main checkout and from a linked worktree", () => {
    const { r, w } = makeClone();
    const expected = runsUnderGit(r);

    expect(samePath(resolvedRunsDir(r), expected)).toBe(true);
    expect(samePath(resolvedRunsDir(w), expected)).toBe(true);
  });

  it("answers <dir>/aidd_docs/runs outside any checkout", () => {
    const outside = mkdtempSync(join(tmpdir(), "aidd-common-dir-"));
    tempRoots.push(outside);

    expect(samePath(resolvedRunsDir(outside), join(outside, "aidd_docs", "runs"))).toBe(true);
  });

  it("answers AIDD_RUNS_DIR outright, and then legacyRunsDirs is empty", () => {
    const { r } = makeClone();
    process.env.AIDD_RUNS_DIR = "/custom/runs";

    expect(resolvedRunsDir(r)).toBe("/custom/runs");
    expect(legacyRunsDirs(r)).toEqual([]);
  });
});

describe("legacyRunsDirs()", () => {
  it("lists the current checkout first, then the other live one", () => {
    const { r, w } = makeClone();
    mkdirSync(join(r, "aidd_docs", "runs"), { recursive: true });
    mkdirSync(join(w, "aidd_docs", "runs"), { recursive: true });

    const fromMain = legacyRunsDirs(r);
    const fromWorktree = legacyRunsDirs(w);

    expect(fromMain).toHaveLength(2);
    expect(samePath(fromMain[0] ?? "", join(r, "aidd_docs", "runs"))).toBe(true);
    expect(samePath(fromMain[1] ?? "", join(w, "aidd_docs", "runs"))).toBe(true);
    expect(fromWorktree).toHaveLength(2);
    expect(samePath(fromWorktree[0] ?? "", join(w, "aidd_docs", "runs"))).toBe(true);
    expect(samePath(fromWorktree[1] ?? "", join(r, "aidd_docs", "runs"))).toBe(true);
  });

  it("lists only the directories that exist", () => {
    const { r, w } = makeClone();
    mkdirSync(join(w, "aidd_docs", "runs"), { recursive: true });

    const listed = legacyRunsDirs(r);

    expect(listed).toHaveLength(1);
    expect(samePath(listed[0] ?? "", join(w, "aidd_docs", "runs"))).toBe(true);
  });

  it("is empty outside any checkout", () => {
    const outside = mkdtempSync(join(tmpdir(), "aidd-common-dir-"));
    tempRoots.push(outside);

    expect(legacyRunsDirs(outside)).toEqual([]);
  });
});
