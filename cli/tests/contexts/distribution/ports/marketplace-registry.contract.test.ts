import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { describeMarketplaceRegistryContract } from "../testing/marketplace-registry-contract.js";
import { makeRegistryAdapter } from "../testing/registry-adapter.js";

describeMarketplaceRegistryContract("the in-memory registry", async () => ({
  registry: new InMemoryMarketplaceRegistry(),
  projectRoot: "/project",
  otherProjectRoot: "/other",
  dispose: async () => undefined,
}));

describeMarketplaceRegistryContract("MarketplaceRegistryAdapter over a directory", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-marketplace-registry-")));
  return {
    registry: makeRegistryAdapter(join(root, "config")),
    projectRoot: join(root, "project"),
    otherProjectRoot: join(root, "other"),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
