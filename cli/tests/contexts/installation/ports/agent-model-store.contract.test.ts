import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentModelStoreAdapter } from "../../../../src/contexts/installation/infrastructure/agent-model-store-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import {
  type AgentModelStoreSubject,
  describeAgentModelStoreContract,
} from "../testing/agent-model-store.contract.js";
import { InMemoryAgentModelStore } from "../testing/in-memory-agent-model-store.fake.js";

describeAgentModelStoreContract(
  "the in-memory store",
  async (): Promise<AgentModelStoreSubject> => ({
    store: new InMemoryAgentModelStore(),
    dispose: async () => undefined,
  })
);

describeAgentModelStoreContract(
  "the store on a temp dir",
  async (): Promise<AgentModelStoreSubject> => {
    const dir = await mkdtemp(join(tmpdir(), "aidd-agent-models-contract-"));
    return {
      store: new AgentModelStoreAdapter(new FileAdapter(), () => dir),
      dispose: () => rm(dir, { recursive: true, force: true }),
    };
  }
);
