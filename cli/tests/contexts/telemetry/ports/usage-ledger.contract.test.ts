import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import { InMemoryLedger } from "../testing/in-memory-ledger.js";
import {
  describeUsageLedgerContract,
  type LedgerSubject,
} from "../testing/usage-ledger-contract.js";

describeUsageLedgerContract(
  "the in-memory ledger",
  async (): Promise<LedgerSubject> => ({
    ledger: new InMemoryLedger(),
    dispose: async () => undefined,
  })
);

describeUsageLedgerContract("the ledger on a temp dir", async (): Promise<LedgerSubject> => {
  const root = await mkdtemp(join(tmpdir(), "aidd-ledger-contract-"));
  return {
    ledger: new UsageLedgerAdapter(join(root, "ledger"), new PrivateStorageAdapter()),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
