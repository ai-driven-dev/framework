import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceBrowseUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-browse-use-case.js";
import { MarketplaceNotFoundError, OfflineError } from "../../../../src/domain/errors.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import type { Prompter } from "../../../../src/domain/ports/prompter.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { KeepPrompter } from "../helpers.js";

const VALID_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");

class DenyPrompter extends KeepPrompter {
  override async confirm(): Promise<boolean> {
    return false;
  }
}

describe("MarketplaceBrowseUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-browse-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-browse-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  function buildUseCase(prompter: Prompter): {
    useCase: MarketplaceBrowseUseCase;
    registry: MarketplaceRegistryAdapter;
  } {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new MarketplaceBrowseUseCase(
      new PluginCatalogRepositoryAdapter(fs),
      registry,
      new PluginFetcherAdapter(fs),
      prompter
    );
    return { useCase, registry };
  }

  it("returns the catalog when fetch succeeds", async () => {
    const { useCase, registry } = buildUseCase(new KeepPrompter());
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot,
      useCachedOnFailure: false,
    });

    expect(result.fromCache).toBe(false);
    expect(result.catalog.plugins.length).toBeGreaterThan(0);
  });

  it("throws MarketplaceNotFoundError when name is not registered", async () => {
    const { useCase } = buildUseCase(new KeepPrompter());
    await expect(
      useCase.execute({ name: "missing", projectRoot, useCachedOnFailure: false })
    ).rejects.toThrow(MarketplaceNotFoundError);
  });

  it("throws OfflineError when fetch fails and the user declines cache", async () => {
    const { useCase, registry } = buildUseCase(new DenyPrompter());
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: "/nonexistent/path/12345" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({ name: "awesome", projectRoot, useCachedOnFailure: false })
    ).rejects.toThrow(OfflineError);
  });
});
