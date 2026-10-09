import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { samePath } from "../../../src/kernel/paths.js";
import { gitCommonDirAbove, worktreeRootsOf } from "../../../src/kernel/reading/git-common-dir.js";
import { environmentWithoutGitVariables } from "../../../src/runtime/git/git-environment.js";

const gitEnv = environmentWithoutGitVariables(process.env);
const roots: string[] = [];

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", args, { cwd, env: gitEnv });
}

/** A committed repo, one linked worktree, and a bare clone of it with its own worktree. */
function makeClone(): { root: string; r: string; w: string; bare: string; bw: string } {
  const root = mkdtempSync(join(tmpdir(), "aidd-common-dir-"));
  roots.push(root);
  const r = join(root, "r");
  const w = join(root, "w");
  const bare = join(root, "b.git");
  const bw = join(root, "bw");
  mkdirSync(r);
  git(r, ["init", "-q"]);
  git(r, ["-c", "user.email=t@e", "-c", "user.name=t", "commit", "--allow-empty", "-m", "seed"]);
  git(r, ["worktree", "add", "-q", w]);
  git(root, ["clone", "-q", "--bare", r, bare]);
  git(bare, ["worktree", "add", "-q", bw]);
  return { root, r, w, bare, bw };
}

function canon(path: string): string {
  return realpathSync.native(path);
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { recursive: true, force: true });
  }
});

describe("gitCommonDirAbove()", () => {
  it("names the main checkout's .git from the checkout and from a subdirectory", () => {
    const { r } = makeClone();
    const nested = join(r, "a", "b");
    mkdirSync(nested, { recursive: true });

    expect(samePath(canon(gitCommonDirAbove(r) ?? ""), canon(join(r, ".git")))).toBe(true);
    expect(samePath(canon(gitCommonDirAbove(nested) ?? ""), canon(join(r, ".git")))).toBe(true);
  });

  it("names the main checkout's .git from a linked worktree", () => {
    const { r, w } = makeClone();

    expect(samePath(canon(gitCommonDirAbove(w) ?? ""), canon(join(r, ".git")))).toBe(true);
  });

  it("names the bare directory from a bare clone's worktree", () => {
    const { bare, bw } = makeClone();

    expect(samePath(canon(gitCommonDirAbove(bw) ?? ""), canon(bare))).toBe(true);
  });

  it("answers the git dir itself when the pointer's commondir cannot be read", () => {
    const dir = mkdtempSync(join(tmpdir(), "aidd-common-dir-"));
    roots.push(dir);
    writeFileSync(join(dir, ".git"), "gitdir: /does/not/exist/.git/worktrees/x\n");

    expect(
      samePath(gitCommonDirAbove(dir) ?? "", resolve(dir, "/does/not/exist/.git/worktrees/x"))
    ).toBe(true);
  });

  it("answers null outside any checkout", () => {
    const dir = mkdtempSync(join(tmpdir(), "aidd-common-dir-"));
    roots.push(dir);

    expect(gitCommonDirAbove(dir)).toBeNull();
  });
});

describe("worktreeRootsOf()", () => {
  it("lists the main root first, then each live linked worktree", () => {
    const { r, w } = makeClone();

    const rootsOf = worktreeRootsOf(join(r, ".git"));

    expect(rootsOf).toHaveLength(2);
    expect(samePath(canon(rootsOf[0] ?? ""), canon(r))).toBe(true);
    expect(samePath(canon(rootsOf[1] ?? ""), canon(w))).toBe(true);
  });

  it("skips a worktree deleted from disk and still registered", () => {
    const { r, w } = makeClone();
    rmSync(w, { recursive: true, force: true });

    const rootsOf = worktreeRootsOf(join(r, ".git"));

    expect(rootsOf).toHaveLength(1);
    expect(samePath(canon(rootsOf[0] ?? ""), canon(r))).toBe(true);
  });

  it("lists no main root for a bare clone", () => {
    const { bare, bw } = makeClone();

    const rootsOf = worktreeRootsOf(bare);

    expect(rootsOf).toHaveLength(1);
    expect(samePath(canon(rootsOf[0] ?? ""), canon(bw))).toBe(true);
  });
});
