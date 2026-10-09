import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvedRunsDir, samePath } from "../../src/kernel/paths.js";
import { environmentWithoutGitVariables } from "../../src/runtime/git/git-environment.js";
import { journalRepo } from "../helpers/telemetry-journal-hook.js";

const gitEnv = environmentWithoutGitVariables(process.env);

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", args, { cwd, env: gitEnv });
}

function switchOn(checkout: string): void {
  mkdirSync(join(checkout, ".aidd"), { recursive: true });
  writeFileSync(join(checkout, ".aidd", "config.json"), '{"telemetry":{"enabled":true}}');
}

// `runs` may not exist yet; its grandparent, the common dir, does. The last two segments are
// kept as each side spelled them, so a disagreement on them still shows.
function canon(runsDir: string): string {
  const parent = dirname(runsDir);
  return join(realpathSync.native(dirname(parent)), basename(parent), basename(runsDir));
}

/** The hook asks `git rev-parse`, the CLI reads files: diverged, a report silently reads an
 * empty directory while the hook writes another. */
describe("the hook and the CLI resolve the run journal to one directory", () => {
  let root: string;
  const checkouts: Record<string, string> = {};

  beforeEach(() => {
    delete process.env.AIDD_RUNS_DIR;
    delete process.env.AIDD_TELEMETRY;
    root = mkdtempSync(join(tmpdir(), "aidd-runs-agree-"));
    const r = join(root, "r");
    mkdirSync(r);
    git(r, ["init", "-q"]);
    git(r, ["-c", "user.email=t@e", "-c", "user.name=t", "commit", "--allow-empty", "-m", "seed"]);
    git(r, ["worktree", "add", "-q", join(root, "w")]);
    git(root, ["clone", "-q", "--bare", r, join(root, "b.git")]);
    git(join(root, "b.git"), ["worktree", "add", "-q", join(root, "bw")]);
    mkdirSync(join(r, "sub"));
    for (const checkout of [r, join(root, "w"), join(root, "bw")]) switchOn(checkout);
    checkouts.main = r;
    checkouts.sub = join(r, "sub");
    checkouts.worktree = join(root, "w");
    checkouts.bare = join(root, "bw");
  });

  afterEach(() => {
    delete process.env.AIDD_RUNS_DIR;
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ["the main checkout", "main"],
    ["a subdirectory", "sub"],
    ["a linked worktree", "worktree"],
    ["a bare clone's worktree", "bare"],
  ])("agrees from %s", (_shape, key) => {
    const cwd = checkouts[key] as string;
    const hook = journalRepo.resolveRunsDir(cwd);

    expect(hook).not.toBeNull();
    expect(samePath(canon(hook?.dir ?? ""), canon(resolvedRunsDir(cwd)))).toBe(true);
  });

  it("agrees that AIDD_RUNS_DIR wins", () => {
    const override = join(root, "override");
    process.env.AIDD_RUNS_DIR = override;

    expect(journalRepo.resolveRunsDir(checkouts.main as string)?.dir).toBe(override);
    expect(resolvedRunsDir(checkouts.main as string)).toBe(override);
  });
});
