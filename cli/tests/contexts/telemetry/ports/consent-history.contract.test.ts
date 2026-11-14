import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsentHistoryAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/consent/consent-history-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import {
  type ConsentHistorySubject,
  describeConsentHistoryContract,
} from "../testing/consent-history-contract.js";
import { InMemoryConsentHistory } from "../testing/in-memory-consent-history.js";

describeConsentHistoryContract(
  "the in-memory history",
  async (): Promise<ConsentHistorySubject> => ({
    history: new InMemoryConsentHistory(),
    dispose: async () => undefined,
  })
);

describeConsentHistoryContract(
  "the history on a temp dir",
  async (): Promise<ConsentHistorySubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-consent-contract-"));
    return {
      history: new ConsentHistoryAdapter(join(root, "ledger"), new PrivateStorageAdapter()),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
