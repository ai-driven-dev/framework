import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateStorageAdapter } from "../../../../src/shared/infrastructure/private-storage-adapter.js";
import { InMemoryResolutions } from "../testing/in-memory-resolutions.fake.js";
import { resolutionStoreOver } from "../testing/ledger-adapters.builder.js";
import {
  describeResolutionStoreContract,
  type ResolutionStoreSubject,
} from "../testing/resolution-store.contract.js";

describeResolutionStoreContract(
  "the in-memory store",
  async (): Promise<ResolutionStoreSubject> => ({
    store: new InMemoryResolutions(),
    dispose: async () => undefined,
  })
);

describeResolutionStoreContract(
  "the store on a temp dir",
  async (): Promise<ResolutionStoreSubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-resolutions-contract-"));
    return {
      store: resolutionStoreOver(join(root, "ledger"), new PrivateStorageAdapter()),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
