import { appendFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionBindingStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/declarations/session-binding-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/shared/infrastructure/private-storage-adapter.js";
import { InMemorySessions } from "../testing/in-memory-sessions.fake.js";
import {
  describeSessionBindingStoreContract,
  type SessionBindingSubject,
} from "../testing/session-binding-store.contract.js";

describeSessionBindingStoreContract(
  "the in-memory store",
  async (): Promise<SessionBindingSubject> => {
    const store = new InMemorySessions();
    return {
      store,
      seedCarry: async (carry) => {
        store.carried.push(carry);
      },
      dispose: async () => undefined,
    };
  }
);

describeSessionBindingStoreContract(
  "the store on a temp dir",
  async (): Promise<SessionBindingSubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-sessions-contract-"));
    const dir = join(root, "bindings");
    return {
      store: new SessionBindingStoreAdapter(dir, new PrivateStorageAdapter()),
      seedCarry: async (carry) => {
        await mkdir(dir, { recursive: true });
        await appendFile(join(dir, "carries.jsonl"), `${JSON.stringify(carry)}\n`);
      },
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
