import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { declarationOf } from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { GitBranchBindingStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/declaration/git-branch-binding-store-adapter.js";
import { GitBranchBindingSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/git-branch-binding-source-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../helpers/git-sandbox.js";

let base: string;
let repo: string;
let env: NodeJS.ProcessEnv;
let store: GitBranchBindingStoreAdapter;

beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "aidd-branch-store-")));
  repo = join(base, "repo");
  env = sandboxGitEnv(base);
  initRepository(repo, env);
  git(repo, env, "switch", "-q", "-c", "feat/x");
  store = new GitBranchBindingStoreAdapter(env);
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

const at = new Date("2026-10-09T10:00:00.000Z");
const task = (name: string, ticket: string | null = null) =>
  declarationOf({ kind: "task", task: name, ticket }, at, "command");
const config = (key: string): string => git(repo, env, "config", "--local", "--get", key).trim();
const absent = (key: string): boolean => {
  try {
    git(repo, env, "config", "--local", "--get", key);
    return false;
  } catch {
    return true;
  }
};

describe("the branch HEAD is on", () => {
  it("is read from HEAD, with no remote head while the repository has no remote", async () => {
    expect(await store.heads(repo)).toEqual({ head: "refs/heads/feat/x", originHead: null });
  });

  it("is read from the remote's head when it has one", async () => {
    git(repo, env, "remote", "add", "origin", "git@github.com:acme/widgets.git");
    git(repo, env, "update-ref", "refs/remotes/origin/main", "HEAD");
    git(repo, env, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
    expect(await store.heads(repo)).toEqual({
      head: "refs/heads/feat/x",
      originHead: "refs/remotes/origin/main",
    });
  });

  it("fails loudly in a directory that is not a repository", async () => {
    await expect(store.heads(base)).rejects.toThrow(/could not read/);
  });

  it("is nothing when HEAD is detached", async () => {
    git(repo, env, "checkout", "-q", "--detach");
    expect((await store.heads(repo)).head).toBeNull();
  });
});

describe("declaring on a branch", () => {
  it("writes the three keys the reader reads back", async () => {
    await store.declare(repo, "feat/x", task("checkout-fix", "PROJ-12"));
    expect(config("branch.feat/x.aiddTask")).toBe("checkout-fix");
    expect(config("branch.feat/x.aiddTicket")).toBe("PROJ-12");
    expect(config("branch.feat/x.aiddDeclaredAt")).toBe("2026-10-09T10:00:00.000Z");
    expect(await new GitBranchBindingSourceAdapter(env).bindings(repo)).toEqual([
      {
        branch: "feat/x",
        task: "checkout-fix",
        ticket: "PROJ-12",
        declared_at: "2026-10-09T10:00:00.000Z",
        none: false,
      },
    ]);
  });

  it("survives a rename of the branch", async () => {
    await store.declare(repo, "feat/x", task("checkout-fix"));
    git(repo, env, "branch", "-m", "feat/x", "feat/renamed");
    expect(config("branch.feat/renamed.aiddTask")).toBe("checkout-fix");
    expect(absent("branch.feat/x.aiddTask")).toBe(true);
  });

  it("drops a ticket the new declaration does not name", async () => {
    await store.declare(repo, "feat/x", task("first", "PROJ-12"));
    await store.declare(repo, "feat/x", task("second"));
    expect(config("branch.feat/x.aiddTask")).toBe("second");
    expect(absent("branch.feat/x.aiddTicket")).toBe(true);
  });

  it("declares none as a declaration time with no task and no ticket", async () => {
    await store.declare(repo, "feat/x", task("first", "PROJ-12"));
    await store.declare(repo, "feat/x", declarationOf({ kind: "none" }, at, "command"));
    expect(absent("branch.feat/x.aiddTask")).toBe(true);
    expect(absent("branch.feat/x.aiddTicket")).toBe(true);
    expect(config("branch.feat/x.aiddDeclaredAt")).toBe("2026-10-09T10:00:00.000Z");
    expect(await new GitBranchBindingSourceAdapter(env).bindings(repo)).toMatchObject([
      { task: null, none: true },
    ]);
  });

  it("declares none on a branch that never had a task", async () => {
    await store.declare(repo, "feat/x", declarationOf({ kind: "none" }, at, "command"));
    expect(config("branch.feat/x.aiddDeclaredAt")).toBe("2026-10-09T10:00:00.000Z");
  });

  it("keeps a task name that starts with a dash or holds quotes whole", async () => {
    await store.declare(repo, "feat/x", task('-x "quoted" $HOME'));
    expect(config("branch.feat/x.aiddTask")).toBe('-x "quoted" $HOME');
  });

  it("writes to the repository's config, not the machine's", async () => {
    await store.declare(repo, "feat/x", task("t"));
    expect(git(repo, env, "config", "--local", "--list")).toContain("branch.feat/x.aiddtask=t");
    expect(absent("branch.feat/x.aiddTask")).toBe(false);
  });

  it("fails loudly in a directory that is not a repository, declaring or clearing", async () => {
    await expect(store.declare(base, "feat/x", task("t"))).rejects.toThrow(/git config/);
    await expect(
      store.declare(base, "feat/x", declarationOf({ kind: "none" }, at, "command"))
    ).rejects.toThrow(/git config/);
  });
});
