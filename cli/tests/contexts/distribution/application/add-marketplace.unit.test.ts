import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AddMarketplace } from "../../../../src/contexts/distribution/application/add-marketplace.js";
import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ResolveMarketplace } from "../../../../src/contexts/distribution/application/resolve-marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import type {
  MarketplaceRemovalRequest,
  MarketplaceRemover,
} from "../../../../src/contexts/distribution/ports/marketplace-remover.js";
import {
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
  MarketplaceAlreadyRegisteredError,
  TrustDeniedError,
} from "../../../../src/shared/domain/errors.js";
import type { Prompter } from "../../../../src/shared/ports/prompter.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { FixturePluginFetcher } from "../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { InMemoryMarketplaceTrustStore } from "../../../helpers/ports/in-memory-marketplace-trust-store.js";
import { KeepPrompter } from "../../../helpers/ports/scripted-prompter.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const MARKETPLACE_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";

class DenyPrompter extends KeepPrompter {
  override async confirm(): Promise<boolean> {
    return false;
  }
}

async function buildUseCase(prompter: Prompter = new KeepPrompter()) {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileAdapter({}, hasher);
  await seedFromDirectory(fs, MARKETPLACE_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const trustStore = new InMemoryMarketplaceTrustStore();
  const fetchMarketplaceSource = new FetchMarketplaceSource(new FixturePluginFetcher());
  const resolveMarketplace = new ResolveMarketplace(
    fetchMarketplaceSource,
    new PluginCatalogRepositoryAdapter(fs)
  );
  const events: string[] = [];
  const resolve = resolveMarketplace.execute.bind(resolveMarketplace);
  resolveMarketplace.execute = async (command) => {
    events.push("resolve");
    return resolve(command);
  };
  const removals: MarketplaceRemovalRequest[] = [];
  const remover: MarketplaceRemover = {
    remove: async (request) => {
      events.push("remove");
      removals.push(request);
      await registry.delete(request.projectRoot, request.name, request.scope ?? "project");
    },
  };
  const useCase = new AddMarketplace(registry, trustStore, resolveMarketplace, prompter, remover);
  return { useCase, registry, trustStore, events, removals };
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

    it("overwrite=true replaces an existing entry without throwing", async () => {
      const { useCase, registry } = await buildUseCase();
      const source = { kind: "local" as const, path: MARKETPLACE_FIXTURE };
      await useCase.execute({
        source,
        name: "awesome",
        scope: "project",
        projectRoot: PROJECT_ROOT,
        autoTrust: true,
      });

      await useCase.execute({
        source,
        name: "awesome",
        scope: "project",
        projectRoot: PROJECT_ROOT,
        autoTrust: true,
        overwrite: true,
      });

      const list = await registry.list(PROJECT_ROOT);
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe("awesome");
    });

    it("with overwrite, a fetch failure leaves the previous entry removed", async () => {
      const { useCase, registry, events, removals } = await buildUseCase();
      const source = { kind: "local" as const, path: MARKETPLACE_FIXTURE };
      const command = { name: "awesome", scope: "project" as const, projectRoot: PROJECT_ROOT };
      await useCase.execute({ ...command, source, autoTrust: true });

      await expect(
        useCase.execute({
          ...command,
          source: { kind: "local", path: "/empty-marketplace-dir" },
          autoTrust: true,
          overwrite: true,
        })
      ).rejects.toThrow(InvalidPluginManifestError);

      expect(await registry.list(PROJECT_ROOT)).toHaveLength(0);
      expect(events).toEqual(["resolve", "remove", "resolve"]);
      expect(removals).toEqual([
        { name: "awesome", projectRoot: PROJECT_ROOT, autoConfirm: true, scope: "project" },
      ]);
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
      const { useCase } = await buildUseCase(new DenyPrompter());

      await expect(
        useCase.execute({
          source: { kind: "local", path: MARKETPLACE_FIXTURE },
          name: "awesome",
          scope: "project",
          projectRoot: PROJECT_ROOT,
          autoTrust: false,
        })
      ).rejects.toThrow(TrustDeniedError);
    });
  });
});
