import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceListUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-list-use-case.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";

describe("MarketplaceListUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-list-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-list-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  it("returns marketplaces from the registry", async () => {
    const registry = new MarketplaceRegistryAdapter();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const useCase = new MarketplaceListUseCase(registry);
    const result = await useCase.execute({ projectRoot });

    expect(result.marketplaces).toHaveLength(1);
    expect(result.marketplaces[0]?.name).toBe("awesome");
  });

  it("returns empty when nothing registered", async () => {
    const useCase = new MarketplaceListUseCase(new MarketplaceRegistryAdapter());
    const result = await useCase.execute({ projectRoot });
    expect(result.marketplaces).toEqual([]);
  });
});
