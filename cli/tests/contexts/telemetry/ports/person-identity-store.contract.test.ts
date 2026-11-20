import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PersonIdentityAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/person-identity-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import { InMemoryIdentity } from "../testing/in-memory-identity.fake.js";
import {
  describePersonIdentityStoreContract,
  type PersonIdentitySubject,
} from "../testing/person-identity-store.contract.js";

describePersonIdentityStoreContract(
  "the in-memory store",
  async (): Promise<PersonIdentitySubject> => ({
    store: new InMemoryIdentity(),
    dispose: async () => undefined,
  })
);

describePersonIdentityStoreContract(
  "the store on a temp dir",
  async (): Promise<PersonIdentitySubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-identity-contract-"));
    return {
      store: new PersonIdentityAdapter(join(root, "telemetry"), new PrivateStorageAdapter()),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
