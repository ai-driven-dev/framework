import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { machinePrivateStorage } from "../../../shared/testing/machine-private-storage.builder.js";
import { InMemoryLedger } from "../testing/in-memory-ledger.fake.js";
import { ledgerOver } from "../testing/ledger-adapters.builder.js";
import {
  describeUsageLedgerContract,
  type LedgerSubject,
} from "../testing/usage-ledger.contract.js";

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
    ledger: ledgerOver(join(root, "ledger"), machinePrivateStorage()),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
