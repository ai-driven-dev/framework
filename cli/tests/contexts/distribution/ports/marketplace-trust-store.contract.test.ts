import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarketplaceTrustStoreAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-trust-store-adapter.js";
import { HasherAdapter } from "../../../../src/shared/infrastructure/filesystem/hasher-adapter.js";
import { InMemoryMarketplaceTrustStore } from "../../../helpers/ports/in-memory-marketplace-trust-store.js";
import { describeMarketplaceTrustStoreContract } from "../testing/marketplace-trust-store-contract.js";

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
      store: new MarketplaceTrustStoreAdapter(new HasherAdapter()),
      projectRoot: join(root, "project"),
      otherProjectRoot: join(root, "other"),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
