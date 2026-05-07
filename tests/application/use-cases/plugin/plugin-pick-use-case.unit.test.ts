import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginPickUseCase } from "../../../../src/application/use-cases/plugin/plugin-pick-use-case.js";
import {
  InteractiveOnlyError,
  NoMarketplacesRegisteredError,
} from "../../../../src/domain/errors.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { buildUnitDeps, initAndInstall } from "../../../helpers/ports/build-unit-deps.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import type { InMemoryFileSystem } from "../../../helpers/ports/in-memory-file-system.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { KeepPrompter } from "../../../helpers/ports/scripted-prompter.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const MKT_DIR = "/mkt-source";

function seedMarketplaceFile(
  fs: InMemoryFileSystem,
  dir: string,
  plugins: Array<Record<string, unknown>>
): void {
  fs.writeFile(join(dir, ".claude-plugin/marketplace.json"), JSON.stringify({ plugins }));
}

async function buildUseCase() {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initAndInstall(deps, PROJECT_ROOT, "claude");
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const pluginAdd = new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher
  );
  const useCase = new PluginPickUseCase(
    new PluginCatalogRepositoryAdapter(deps.fs),
    registry,
    deps.pluginFetcher,
    pluginAdd,
    new KeepPrompter()
  );
  return { useCase, deps, registry };
}

describe("PluginPickUseCase", () => {
  it("throws InteractiveOnlyError when not interactive", async () => {
    const { useCase } = await buildUseCase();
    await expect(
      useCase.execute({ toolIds: ["claude"], projectRoot: PROJECT_ROOT, interactive: false })
    ).rejects.toThrow(InteractiveOnlyError);
  });

  it("throws NoMarketplacesRegisteredError when registry is empty", async () => {
    const { useCase } = await buildUseCase();
    await expect(
      useCase.execute({ toolIds: ["claude"], projectRoot: PROJECT_ROOT, interactive: true })
    ).rejects.toThrow(NoMarketplacesRegisteredError);
  });

  it("installs the recommended plugins from the only registered marketplace", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT_DIR, [
      {
        name: "sample-plugin",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        version: "1.0.0",
        recommended: true,
      },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "local",
        source: { kind: "local", path: MKT_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(result.marketplace.name).toBe("local");
    expect(result.installed).toEqual(["sample-plugin"]);
    const manifest = await deps.manifestRepo.load();
    const plugins = manifest?.getPlugins("claude") ?? [];
    const installed = plugins.find((p) => p.name === "sample-plugin");
    expect(installed?.marketplace).toBe("local");
  });
});
