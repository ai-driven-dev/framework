import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitRepositoryLocatorAdapter } from "../../../../src/contexts/telemetry/infrastructure/git-repository-locator-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../helpers/git-sandbox.js";

let base: string;
let env: NodeJS.ProcessEnv;
let locator: GitRepositoryLocatorAdapter;

beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "aidd-locator-")));
  env = sandboxGitEnv(base);
  locator = new GitRepositoryLocatorAdapter(env);
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("locating a working directory", () => {
  it("finds the root of the repository from anywhere inside it", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env, { remote: "git@github.com:acme/widgets.git" });
    await mkdir(join(repo, "src", "deep"), { recursive: true });
    const located = await locator.locate(join(repo, "src", "deep"));
    expect(located).toMatchObject({
      status: "repository",
      root: repo,
      mainRoot: repo,
      remote: "git@github.com:acme/widgets.git",
    });
  });

  it("reads the root commit of a repository with no origin", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env);
    const sha = git(repo, env, "rev-parse", "HEAD").trim();
    expect(await locator.locate(repo)).toMatchObject({
      status: "repository",
      remote: null,
      rootCommit: sha,
    });
  });

  it("takes the lowest root commit when the history has several", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env);
    git(repo, env, "checkout", "-q", "--orphan", "other");
    git(repo, env, "commit", "-q", "--allow-empty", "-m", "second root");
    git(repo, env, "checkout", "-q", "main");
    git(repo, env, "merge", "-q", "--allow-unrelated-histories", "-m", "join", "other");
    const roots = git(repo, env, "rev-list", "--max-parents=0", "HEAD").split("\n").filter(Boolean);
    expect(roots).toHaveLength(2);
    const located = await locator.locate(repo);
    expect(located).toMatchObject({ rootCommit: [...roots].sort()[0] });
  });

  it("has no root commit before the first commit", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env, { commit: false });
    expect(await locator.locate(repo)).toMatchObject({ status: "repository", rootCommit: null });
  });

  it("resolves a linked worktree to the main working tree's repository", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env, { remote: "https://github.com/acme/widgets.git" });
    const linked = join(base, "linked");
    git(repo, env, "worktree", "add", "-q", "-b", "wt", linked);
    const main = await locator.locate(repo);
    const worktree = await locator.locate(linked);
    expect(worktree).toMatchObject({ status: "repository", root: linked, mainRoot: repo });
    expect(worktree).toMatchObject({
      remote: "https://github.com/acme/widgets.git",
      rootCommit: main.status === "repository" ? main.rootCommit : "unreachable",
    });
  });

  it("names the clone by the common git dir, from the main tree or a linked one", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env);
    const linked = join(base, "linked");
    git(repo, env, "worktree", "add", "-q", "-b", "wt", linked);
    const clone = join(repo, ".git");
    expect(await locator.locate(repo)).toMatchObject({ clone });
    expect(await locator.locate(linked)).toMatchObject({ clone });
  });

  it("keeps a worktree of a bare repository as its own main working tree", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env);
    const bare = join(base, "bare.git");
    git(base, env, "clone", "-q", "--bare", repo, bare);
    const linked = join(base, "linked");
    git(bare, env, "worktree", "add", "-q", linked, "main");
    expect(await locator.locate(linked)).toMatchObject({
      status: "repository",
      root: linked,
      mainRoot: linked,
    });
  });

  it.skipIf(process.platform === "win32")(
    "fails for a directory it cannot resolve for a reason other than absence",
    async () => {
      const loop = join(base, "loop");
      await symlink(loop, loop);
      await expect(locator.locate(loop)).rejects.toThrow();
    }
  );

  it("is outside a directory that is no repository", async () => {
    const plain = join(base, "plain");
    await mkdir(plain);
    expect(await locator.locate(plain)).toEqual({ status: "outside-repository" });
  });

  it("is outside the git directory itself, which has no working tree", async () => {
    const repo = join(base, "repo");
    initRepository(repo, env);
    expect(await locator.locate(join(repo, ".git"))).toEqual({ status: "outside-repository" });
  });

  it("is gone for a directory that does not exist", async () => {
    expect(await locator.locate(join(base, "never"))).toEqual({ status: "gone" });
  });

  it("is gone for a path that runs through a file", async () => {
    await writeFile(join(base, "file"), "x");
    expect(await locator.locate(join(base, "file", "child"))).toEqual({ status: "gone" });
  });

  it.skipIf(process.platform === "win32")(
    "sees through a symlinked path to the real root",
    async () => {
      const repo = join(base, "repo");
      initRepository(repo, env);
      await symlink(repo, join(base, "link"));
      expect(await locator.locate(join(base, "link"))).toMatchObject({
        status: "repository",
        root: repo,
      });
    }
  );
});
