import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateStorageAdapter } from "../../../../src/shared/infrastructure/private-storage-adapter.js";
import {
  type BindingsLockSubject,
  describeBindingsLockContract,
} from "../testing/bindings-lock.contract.js";
import { InMemoryBindingsLock } from "../testing/in-memory-bindings-lock.fake.js";
import { bindingsLockOver } from "../testing/lock-adapters.builder.js";

describeBindingsLockContract(
  "the in-memory lock",
  async (): Promise<BindingsLockSubject> => ({
    lock: new InMemoryBindingsLock(),
    dispose: async () => undefined,
  })
);

describeBindingsLockContract("the lock on a temp dir", async (): Promise<BindingsLockSubject> => {
  const root = await mkdtemp(join(tmpdir(), "aidd-bindings-lock-contract-"));
  return {
    lock: bindingsLockOver(join(root, "bindings"), new PrivateStorageAdapter()),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
