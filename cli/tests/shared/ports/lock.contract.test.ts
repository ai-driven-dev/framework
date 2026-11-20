import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserManifestRepositoryAdapter } from "../../../src/contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import { InMemoryRepository } from "../testing/in-memory-repository.js";
import { describeLockContract, type LockSubject } from "../testing/run-lock-contract.js";

describeLockContract(
  "the in-memory repository",
  async (): Promise<LockSubject> => ({
    lock: new InMemoryRepository(),
    dispose: async () => undefined,
  })
);

describeLockContract("the user manifest lock on a temp dir", async (): Promise<LockSubject> => {
  const root = await mkdtemp(join(tmpdir(), "aidd-lock-contract-"));
  return {
    lock: new UserManifestRepositoryAdapter(
      () => root,
      async () => undefined,
      () => null
    ),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
