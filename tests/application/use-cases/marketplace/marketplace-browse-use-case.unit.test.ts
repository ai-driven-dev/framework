import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketplaceBrowseUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-browse-use-case.js";
import { FetchMarketplaceSourceUseCase } from "../../../../src/application/use-cases/shared/fetch-marketplace-source-use-case.js";
import { MarketplaceNotFoundError, OfflineError } from "../../../../src/domain/errors.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import type { Prompter } from "../../../../src/domain/ports/prompter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { FixturePluginFetcher } from "../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { KeepPrompter } from "../../../helpers/ports/scripted-prompter.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const VALID_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";

class DenyPrompter extends KeepPrompter {
  override async confirm(): Promise<boolean> {
    return false;
  }
}

function buildUseCase(prompter: Prompter, fs: InMemoryFileAdapter) {
  const registry = new InMemoryMarketplaceRegistry();
  const fetchMarketplaceSource = new FetchMarketplaceSourceUseCase(new FixturePluginFetcher());
  const useCase = new MarketplaceBrowseUseCase(
    new PluginCatalogRepositoryAdapter(fs),
    registry,
    fetchMarketplaceSource,
    prompter
  );
  return { useCase, registry };
}

describe("MarketplaceBrowseUseCase", () => {
  it("returns the catalog when fetch succeeds", async () => {
    const hasher = new DeterministicHasher();
    const fs = new InMemoryFileAdapter({}, hasher);
    await seedFromDirectory(fs, VALID_FIXTURE, { useAbsolutePaths: true });
    const { useCase, registry } = buildUseCase(new KeepPrompter(), fs);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      useCachedOnFailure: false,
    });

    expect(result.fromCache).toBe(false);
    expect(result.catalog.plugins.length).toBeGreaterThan(0);
  });

  it("throws MarketplaceNotFoundError when name is not registered", async () => {
    const hasher = new DeterministicHasher();
    const fs = new InMemoryFileAdapter({}, hasher);
    const { useCase } = buildUseCase(new KeepPrompter(), fs);

    await expect(
      useCase.execute({ name: "missing", projectRoot: PROJECT_ROOT, useCachedOnFailure: false })
    ).rejects.toThrow(MarketplaceNotFoundError);
  });

  it("throws OfflineError when fetch fails and the user declines cache", async () => {
    const hasher = new DeterministicHasher();
    const fs = new InMemoryFileAdapter({}, hasher);
    // Do NOT seed fixture — fetcher returns path, catalogRepo gets null → triggers offline path
    const { useCase, registry } = buildUseCase(new DenyPrompter(), fs);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: "/nonexistent/path/12345" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({ name: "awesome", projectRoot: PROJECT_ROOT, useCachedOnFailure: false })
    ).rejects.toThrow(OfflineError);
  });
});
