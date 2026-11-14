import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BindingSnapshotStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/binding-snapshot-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import {
  describeBindingSnapshotStoreContract,
  type SnapshotStoreSubject,
} from "../testing/binding-snapshot-store-contract.js";
import { InMemorySnapshots } from "../testing/in-memory-snapshots.js";
import { NO_ALIASES } from "../testing/no-aliases.js";

describeBindingSnapshotStoreContract(
  "the in-memory store",
  async (): Promise<SnapshotStoreSubject> => ({
    store: new InMemorySnapshots(),
    dispose: async () => undefined,
  })
);

describeBindingSnapshotStoreContract(
  "the store on a temp dir",
  async (): Promise<SnapshotStoreSubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-snapshots-contract-"));
    return {
      store: new BindingSnapshotStoreAdapter(
        join(root, "bindings"),
        new PrivateStorageAdapter(),
        NO_ALIASES
      ),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
