import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AddMarketplace } from "../../../../src/contexts/distribution/application/add-marketplace.js";
import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ResolveMarketplace } from "../../../../src/contexts/distribution/application/resolve-marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import {
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
  MarketplaceAlreadyRegisteredError,
  TrustDeniedError,
} from "../../../../src/shared/domain/errors.js";
import type { Prompter } from "../../../../src/shared/ports/prompter.js";
import { FixturePluginFetcher } from "../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { InMemoryMarketplaceTrustStore } from "../../../helpers/ports/in-memory-marketplace-trust-store.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.js";
import { KeepPrompter } from "../../../shared/testing/scripted-prompter.js";

const MARKETPLACE_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";

class DenyPrompter extends KeepPrompter {
  override async confirm(): Promise<boolean> {
    return false;
  }
}

async function buildUseCase(prompter: Prompter = new KeepPrompter()) {
  const fs = new InMemoryFileAdapter({});
  await seedFromDirectory(fs, MARKETPLACE_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const trustStore = new InMemoryMarketplaceTrustStore();
  const fetchMarketplaceSource = new FetchMarketplaceSource(new FixturePluginFetcher());
  const resolveMarketplace = new ResolveMarketplace(
    fetchMarketplaceSource,
    new PluginCatalogRepositoryAdapter(fs)
  );
  const useCase = new AddMarketplace(registry, trustStore, resolveMarketplace, prompter);
  return { useCase, registry, trustStore };
}

describe("AddMarketplace", () => {
  describe("happy path", () => {
    it("persists the marketplace and trusts the source", async () => {
      const { useCase, registry, trustStore } = await buildUseCase(new KeepPrompter());
      const source = { kind: "local" as const, path: MARKETPLACE_FIXTURE };

      const result = await useCase.execute({
        source,
        name: "awesome",
        scope: "project",
        projectRoot: PROJECT_ROOT,
        autoTrust: false,
      });

      expect(result.marketplace.name).toBe("awesome");
      const list = await registry.list(PROJECT_ROOT);
      expect(list).toHaveLength(1);
      expect(await trustStore.isTrusted(PROJECT_ROOT, source)).toBe(true);
    });

    it("autoTrust skips the prompt", async () => {
      const { useCase, trustStore } = await buildUseCase(new DenyPrompter());
      const source = { kind: "local" as const, path: MARKETPLACE_FIXTURE };

      await useCase.execute({
        source,
        name: "awesome",
        scope: "project",
        projectRoot: PROJECT_ROOT,
        autoTrust: true,
      });

      expect(await trustStore.isTrusted(PROJECT_ROOT, source)).toBe(true);
    });
  });

  describe("error paths", () => {
    it("throws when name is already registered", async () => {
      const { useCase } = await buildUseCase();
      const source = { kind: "local" as const, path: MARKETPLACE_FIXTURE };
      await useCase.execute({
        source,
        name: "awesome",
        scope: "project",
        projectRoot: PROJECT_ROOT,
        autoTrust: true,
      });

      await expect(
        useCase.execute({
          source,
          name: "awesome",
          scope: "project",
          projectRoot: PROJECT_ROOT,
          autoTrust: true,
        })
      ).rejects.toThrow(MarketplaceAlreadyRegisteredError);
    });

    it("rejects the reserved name 'aidd-framework'", async () => {
      const { useCase } = await buildUseCase();

      await expect(
        useCase.execute({
          source: { kind: "local", path: MARKETPLACE_FIXTURE },
          name: "aidd-framework",
          scope: "project",
          projectRoot: PROJECT_ROOT,
          autoTrust: true,
        })
      ).rejects.toThrow(InvalidMarketplaceNameError);
    });

    it("throws InvalidPluginManifestError when marketplace.json is missing at the source", async () => {
      const { useCase } = await buildUseCase();
      const source = { kind: "local" as const, path: "/empty-marketplace-dir" };

      await expect(
        useCase.execute({
          source,
          name: "empty",
          scope: "project",
          projectRoot: PROJECT_ROOT,
          autoTrust: true,
        })
      ).rejects.toThrow(InvalidPluginManifestError);
    });

    it("throws TrustDeniedError when the user denies trust", async () => {
      const { useCase, registry } = await buildUseCase(new DenyPrompter());

      await expect(
        useCase.execute({
          source: { kind: "local", path: MARKETPLACE_FIXTURE },
          name: "awesome",
          scope: "project",
          projectRoot: PROJECT_ROOT,
          autoTrust: false,
        })
      ).rejects.toThrow(TrustDeniedError);
      expect(await registry.list(PROJECT_ROOT)).toHaveLength(0);
    });
  });
});
