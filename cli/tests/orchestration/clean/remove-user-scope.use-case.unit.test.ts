import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { saying } from "../../shared/testing/saying.builder.js";
import { hostCatalog } from "../testing/synthetic-hosts.builder.js";
import { userScopeCleanerDeps } from "../testing/user-scope-cleaner.builder.js";

describe("removing the machine-scope registration", () => {
  it("refuses while another project still references the shared source", async () => {
    const deps = userScopeCleanerDeps({
      tools: hostCatalog(),
      fs: new InMemoryFileAdapter(),
      repo: new InMemoryManifestRepository(null),
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
    });
    const inspected = await deps.inspect.execute();

    await expect(
      deps.remove.execute({
        inspection: { ...inspected.inspection, referencingProjects: ["/project-a"] },
        projectRoot: "/wherever",
      })
    ).rejects.toThrow(saying(/\/project-a/));
  });

  it("unregisters the framework marketplace at user scope", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    registry.seed(
      "/wherever",
      Marketplace.create({
        name: FRAMEWORK_MARKETPLACE_NAME,
        source: { kind: "local", path: "/src/framework" },
        scope: "user",
        addedAt: "2001-01-01T00:00:00Z",
      })
    );
    const deps = userScopeCleanerDeps({
      tools: hostCatalog(),
      fs: new InMemoryFileAdapter(),
      repo: new InMemoryManifestRepository(null),
      marketplaceRegistry: registry,
    });
    const inspected = await deps.inspect.execute();

    await deps.remove.execute({ inspection: inspected.inspection, projectRoot: "/wherever" });

    await expect(registry.list("/wherever")).resolves.toStrictEqual([]);
  });
});
