import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitBranchBindingStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/git/git-branch-binding-store-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../shared/testing/git-sandbox.builder.js";
import {
  type BranchBindingStoreSubject,
  describeBranchBindingStoreContract,
} from "../testing/branch-binding-store.contract.js";
import { FakeBranchStore } from "../testing/fake-branch-store.fake.js";

describeBranchBindingStoreContract(
  "the fake",
  async (): Promise<BranchBindingStoreSubject> => ({
    store: new FakeBranchStore(),
    root: "/work/app",
    branch: "feat/x",
    dispose: async () => undefined,
  })
);

describeBranchBindingStoreContract("git config", async (): Promise<BranchBindingStoreSubject> => {
  const base = await realpath(await mkdtemp(join(tmpdir(), "aidd-branch-store-contract-")));
  const env = sandboxGitEnv(base);
  const root = join(base, "repo");
  initRepository(root, env);
  git(root, env, "switch", "-q", "-c", "feat/x");
  return {
    store: new GitBranchBindingStoreAdapter(env),
    root,
    branch: "feat/x",
    dispose: () => rm(base, { recursive: true, force: true }),
  };
});
