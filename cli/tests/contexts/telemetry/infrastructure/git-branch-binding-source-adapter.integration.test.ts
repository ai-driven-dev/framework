import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitBranchBindingSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/git-branch-binding-source-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../helpers/git-sandbox.js";

let base: string;
let repo: string;
let env: NodeJS.ProcessEnv;
let source: GitBranchBindingSourceAdapter;

beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "aidd-bindings-")));
  repo = join(base, "repo");
  env = sandboxGitEnv(base);
  initRepository(repo, env);
  source = new GitBranchBindingSourceAdapter(env);
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("reading branch declarations from git config", () => {
  it("is empty while no branch is declared", async () => {
    expect(await source.bindings(repo)).toEqual([]);
  });

  it("reads the keys as the declaration command will write them", async () => {
    git(repo, env, "config", "branch.feat/x.aiddTask", "checkout-fix");
    git(repo, env, "config", "branch.feat/x.aiddTicket", "PROJ-12");
    git(repo, env, "config", "branch.feat/x.aiddDeclaredAt", "2026-10-07T10:00:00.000Z");
    expect(await source.bindings(repo)).toEqual([
      {
        branch: "feat/x",
        task: "checkout-fix",
        ticket: "PROJ-12",
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
  });

  it("reads a branch named with dots and capitals whole", async () => {
    git(repo, env, "config", "branch.Release/1.2.aiddTask", "t");
    expect((await source.bindings(repo)).map((b) => b.branch)).toEqual(["Release/1.2"]);
  });

  it("reads a declaration of no task as none", async () => {
    git(repo, env, "config", "branch.x.aiddDeclaredAt", "2026-10-07T10:00:00.000Z");
    expect(await source.bindings(repo)).toMatchObject([{ branch: "x", task: null, none: true }]);
  });

  it("ignores branch settings that are not declarations", async () => {
    git(repo, env, "config", "branch.main.remote", "origin");
    expect(await source.bindings(repo)).toEqual([]);
  });

  it("reads the same keys from a linked worktree, which shares the repository's config", async () => {
    git(repo, env, "config", "branch.x.aiddTask", "t");
    const linked = join(base, "linked");
    git(repo, env, "worktree", "add", "-q", "-b", "wt", linked);
    expect((await source.bindings(linked)).map((b) => b.branch)).toEqual(["x"]);
  });

  it("fails for a directory that is no repository, instead of reading it as undeclared", async () => {
    const plain = join(base, "plain");
    await mkdir(plain);
    await expect(source.bindings(plain)).rejects.toThrow(/git config could not be read/);
  });

  it("fails when git cannot be run in the directory at all", async () => {
    await expect(source.bindings(join(base, "never"))).rejects.toThrow(/git could not be run/);
  });
});

describe("reading a branch's creation from its reflog", () => {
  const at = (iso: string): NodeJS.ProcessEnv => ({
    ...env,
    GIT_COMMITTER_DATE: iso,
    GIT_AUTHOR_DATE: iso,
  });

  it("is the oldest entry, whatever the branch did since", async () => {
    git(repo, at("2026-01-02T03:04:05Z"), "branch", "feat/old");
    git(repo, at("2026-02-03T04:05:06Z"), "checkout", "-q", "feat/old");
    git(repo, at("2026-03-04T05:06:07Z"), "commit", "-q", "--allow-empty", "-m", "later");
    expect(await source.createdAt(repo, "feat/old")).toBe("2026-01-02T03:04:05.000Z");
  });

  it("is unknown for a branch that does not exist", async () => {
    expect(await source.createdAt(repo, "never")).toBeNull();
  });

  it("is unknown when the repository keeps no reflog", async () => {
    git(repo, env, "config", "core.logAllRefUpdates", "false");
    git(repo, env, "branch", "quiet");
    expect(await source.createdAt(repo, "quiet")).toBeNull();
  });
});
