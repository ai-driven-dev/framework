import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitBranchBindingSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/git/git-branch-binding-source-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../helpers/git-sandbox.js";
import {
  type BranchBindingSourceSubject,
  describeBranchBindingSourceContract,
} from "../testing/branch-binding-source-contract.js";
import { FakeBindings } from "../testing/fake-bindings.js";

const ROOT = "/work/app";

describeBranchBindingSourceContract("the fake", async (): Promise<BranchBindingSourceSubject> => {
  const fake = new FakeBindings();
  return {
    source: fake,
    root: ROOT,
    declare: async ({ branch, task, ticket, declaredAt }) => {
      fake.bindingsByRoot.set(ROOT, [
        ...(fake.bindingsByRoot.get(ROOT) ?? []),
        { branch, task, ticket, declared_at: declaredAt, none: task === null },
      ]);
    },
    createBranch: async (branch, at) => {
      fake.creation.set(branch, new Date(at).toISOString());
    },
    dispose: async () => undefined,
  };
});

describeBranchBindingSourceContract(
  "git config and reflog",
  async (): Promise<BranchBindingSourceSubject> => {
    const base = await realpath(await mkdtemp(join(tmpdir(), "aidd-bindings-contract-")));
    const env = sandboxGitEnv(base);
    const root = join(base, "repo");
    initRepository(root, env);
    return {
      source: new GitBranchBindingSourceAdapter(env),
      root,
      declare: async ({ branch, task, ticket, declaredAt }) => {
        const set = (key: string, value: string): string =>
          git(root, env, "config", `branch.${branch}.${key}`, value);
        if (task !== null) set("aiddTask", task);
        if (ticket !== null) set("aiddTicket", ticket);
        set("aiddDeclaredFor", branch);
        set("aiddDeclaredAt", declaredAt);
      },
      createBranch: async (branch, at) => {
        git(root, { ...env, GIT_COMMITTER_DATE: at, GIT_AUTHOR_DATE: at }, "branch", branch);
      },
      dispose: () => rm(base, { recursive: true, force: true }),
    };
  }
);
