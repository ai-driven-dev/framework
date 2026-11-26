import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserScopeLockAdapter } from "../../../src/contexts/machine-claims/infrastructure/lock.js";
import { InMemoryRepository } from "../testing/in-memory-repository.fake.js";
import { describeLockContract, type LockSubject } from "../testing/run-lock.contract.js";

describeLockContract(
  "the in-memory repository",
  async (): Promise<LockSubject> => ({
    lock: new InMemoryRepository(),
    dispose: async () => undefined,
  })
);

describeLockContract("the machine lock on a temp dir", async (): Promise<LockSubject> => {
  const root = await mkdtemp(join(tmpdir(), "aidd-lock-contract-"));
  return {
    lock: new UserScopeLockAdapter(() => join(root, "manifest.json.lock")),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
