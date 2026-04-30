import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceAddUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-add-use-case.js";
import { MarketplaceRemoveUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-remove-use-case.js";
import {
  InvalidMarketplaceNameError,
  MarketplaceAlreadyRegisteredError,
  TrustDeniedError,
} from "../../../../src/domain/errors.js";
import type { Prompter } from "../../../../src/domain/ports/prompter.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { MarketplaceTrustStoreAdapter } from "../../../../src/infrastructure/adapters/marketplace-trust-store-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { KeepPrompter } from "../helpers.js";

const MARKETPLACE_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");

class DenyPrompter extends KeepPrompter {
  override async confirm(): Promise<boolean> {
    return false;
  }
}

function buildUseCase(
  prompter: Prompter,
  projectRoot: string
): {
  useCase: MarketplaceAddUseCase;
  registry: MarketplaceRegistryAdapter;
  trustStore: MarketplaceTrustStoreAdapter;
} {
  const hasher = new HasherAdapter();
  const fs = new FileSystemAdapter(hasher);
  const registry = new MarketplaceRegistryAdapter();
  const trustStore = new MarketplaceTrustStoreAdapter(hasher);
  const removeUseCase = new MarketplaceRemoveUseCase(
    fs,
    new ManifestRepositoryAdapter(projectRoot),
    registry,
    prompter
  );
  const useCase = new MarketplaceAddUseCase(
    new PluginCatalogRepositoryAdapter(fs),
    registry,
    trustStore,
    new PluginFetcherAdapter(fs),
    prompter,
    removeUseCase
  );
  return { useCase, registry, trustStore };
}

describe("MarketplaceAddUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-add-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-add-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  describe("happy path", () => {
    it("persists the marketplace and trusts the source", async () => {
      const { useCase, registry, trustStore } = buildUseCase(new KeepPrompter(), projectRoot);

      const result = await useCase.execute({
        source: { kind: "local", path: MARKETPLACE_FIXTURE },
        name: "awesome",
        scope: "project",
        projectRoot,
        autoTrust: false,
      });

      expect(result.marketplace.name).toBe("awesome");
      const list = await registry.list(projectRoot);
      expect(list).toHaveLength(1);
      expect(
        await trustStore.isTrusted(projectRoot, {
          kind: "local",
          path: MARKETPLACE_FIXTURE,
        })
      ).toBe(true);
    });

    it("autoTrust skips the prompt", async () => {
      const { useCase, trustStore } = buildUseCase(new DenyPrompter(), projectRoot);

      await useCase.execute({
        source: { kind: "local", path: MARKETPLACE_FIXTURE },
        name: "awesome",
        scope: "project",
        projectRoot,
        autoTrust: true,
      });

      expect(
        await trustStore.isTrusted(projectRoot, {
          kind: "local",
          path: MARKETPLACE_FIXTURE,
        })
      ).toBe(true);
    });
  });

  describe("error paths", () => {
    it("throws when name is already registered", async () => {
      const { useCase } = buildUseCase(new KeepPrompter(), projectRoot);
      await useCase.execute({
        source: { kind: "local", path: MARKETPLACE_FIXTURE },
        name: "awesome",
        scope: "project",
        projectRoot,
        autoTrust: true,
      });

      await expect(
        useCase.execute({
          source: { kind: "local", path: MARKETPLACE_FIXTURE },
          name: "awesome",
          scope: "project",
          projectRoot,
          autoTrust: true,
        })
      ).rejects.toThrow(MarketplaceAlreadyRegisteredError);
    });

    it("rejects the reserved name 'aidd-framework'", async () => {
      const { useCase } = buildUseCase(new KeepPrompter(), projectRoot);

      await expect(
        useCase.execute({
          source: { kind: "local", path: MARKETPLACE_FIXTURE },
          name: "aidd-framework",
          scope: "project",
          projectRoot,
          autoTrust: true,
        })
      ).rejects.toThrow(InvalidMarketplaceNameError);
    });

    it("overwrite=true replaces an existing entry without throwing", async () => {
      const { useCase, registry } = buildUseCase(new KeepPrompter(), projectRoot);
      await useCase.execute({
        source: { kind: "local", path: MARKETPLACE_FIXTURE },
        name: "awesome",
        scope: "project",
        projectRoot,
        autoTrust: true,
      });

      await useCase.execute({
        source: { kind: "local", path: MARKETPLACE_FIXTURE },
        name: "awesome",
        scope: "project",
        projectRoot,
        autoTrust: true,
        overwrite: true,
      });

      const list = await registry.list(projectRoot);
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe("awesome");
    });

    it("throws TrustDeniedError when the user denies trust", async () => {
      const { useCase } = buildUseCase(new DenyPrompter(), projectRoot);

      await expect(
        useCase.execute({
          source: { kind: "local", path: MARKETPLACE_FIXTURE },
          name: "awesome",
          scope: "project",
          projectRoot,
          autoTrust: false,
        })
      ).rejects.toThrow(TrustDeniedError);
    });
  });
});
