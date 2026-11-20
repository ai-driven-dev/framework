import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitRepositoryLocatorAdapter } from "../../../../src/contexts/telemetry/infrastructure/git/git-repository-locator-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../helpers/git-sandbox.js";
import { cloneOf } from "../testing/clone.builder.js";
import { FakeLocator } from "../testing/fake-locator.fake.js";
import {
  describeRepositoryLocatorContract,
  type RepositoryLocatorSubject,
} from "../testing/repository-locator.contract.js";

describeRepositoryLocatorContract("the fake", async (): Promise<RepositoryLocatorSubject> => {
  const fake = new FakeLocator();
  let made = 0;
  return {
    locator: fake,
    missingDirectory: () => "/work/missing",
    plainDirectory: async () => {
      const plain = "/work/plain";
      fake.directories.set(plain, { status: "outside-repository" });
      return plain;
    },
    repository: async ({ remote, commit }) => {
      made += 1;
      const root = `/work/repo-${made}`;
      fake.directories.set(root, {
        status: "repository",
        root,
        mainRoot: root,
        clone: cloneOf(`${root}/.git`),
        remote: remote ?? null,
        rootCommit: commit ? "a1b2c3" : null,
      });
      return root;
    },
    linkedWorktree: async (main) => {
      const linked = `${main}-linked`;
      const located = fake.directories.get(main);
      if (located?.status !== "repository") throw new Error(`${main} is no repository`);
      fake.directories.set(linked, { ...located, root: linked, mainRoot: main });
      return linked;
    },
    dispose: async () => undefined,
  };
});

describeRepositoryLocatorContract("git", async (): Promise<RepositoryLocatorSubject> => {
  const base = await realpath(await mkdtemp(join(tmpdir(), "aidd-locator-contract-")));
  const env = sandboxGitEnv(base);
  let made = 0;
  return {
    locator: new GitRepositoryLocatorAdapter(env),
    missingDirectory: () => join(base, "missing"),
    plainDirectory: async () => {
      const plain = join(base, "plain");
      await mkdir(plain);
      return plain;
    },
    repository: async ({ remote, commit }) => {
      made += 1;
      const root = join(base, `repo-${made}`);
      initRepository(root, env, { remote, commit });
      return root;
    },
    linkedWorktree: async (main) => {
      const linked = `${main}-linked`;
      git(main, env, "worktree", "add", "-q", "-b", "linked", linked);
      return linked;
    },
    dispose: () => rm(base, { recursive: true, force: true }),
  };
});
