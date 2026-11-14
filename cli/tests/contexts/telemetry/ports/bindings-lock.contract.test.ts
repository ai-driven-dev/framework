import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BindingsLockAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/declarations/bindings-lock-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import {
  type BindingsLockSubject,
  describeBindingsLockContract,
} from "../testing/bindings-lock-contract.js";
import { InMemoryBindingsLock } from "../testing/in-memory-bindings-lock.js";

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
    lock: new BindingsLockAdapter(join(root, "bindings"), new PrivateStorageAdapter()),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
