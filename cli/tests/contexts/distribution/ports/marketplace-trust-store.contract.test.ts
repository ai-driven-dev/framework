import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarketplaceTrustStoreAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-trust-store-adapter.js";
import { InMemoryMarketplaceTrustStore } from "../../../shared/testing/in-memory-marketplace-trust-store.fake.js";
import { machinePrivateStorage } from "../../../shared/testing/machine-private-storage.builder.js";
import { describeMarketplaceTrustStoreContract } from "../testing/marketplace-trust-store.contract.js";

describeMarketplaceTrustStoreContract("in memory", async () => ({
  store: new InMemoryMarketplaceTrustStore(),
  projectRoot: "/project",
  otherProjectRoot: "/other",
  dispose: async () => undefined,
}));

describeMarketplaceTrustStoreContract(
  "by MarketplaceTrustStoreAdapter in the project",
  async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-marketplace-trust-")));
    return {
      store: new MarketplaceTrustStoreAdapter(machinePrivateStorage()),
      projectRoot: join(root, "project"),
      otherProjectRoot: join(root, "other"),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
