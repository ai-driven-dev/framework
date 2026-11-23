import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LeftOutAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/left-out-adapter.js";
import { machinePrivateStorage } from "../../../shared/testing/machine-private-storage.builder.js";
import { InMemoryLeftOut } from "../testing/in-memory-left-out.fake.js";
import {
  describeLeftOutStoreContract,
  type LeftOutStoreSubject,
} from "../testing/left-out-store.contract.js";

describeLeftOutStoreContract(
  "in memory",
  async (): Promise<LeftOutStoreSubject> => ({
    store: new InMemoryLeftOut([]),
    dispose: async () => undefined,
  })
);

describeLeftOutStoreContract("on a temp dir", async (): Promise<LeftOutStoreSubject> => {
  const dir = await mkdtemp(join(tmpdir(), "aidd-left-out-contract-"));
  return {
    store: new LeftOutAdapter(dir, machinePrivateStorage()),
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
});
