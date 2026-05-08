import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginInstallFromMarketplaceUseCase } from "../../../../src/application/use-cases/plugin/plugin-install-from-marketplace-use-case.js";
import { ResolveMarketplaceUseCase } from "../../../../src/application/use-cases/shared/resolve-marketplace-use-case.js";
import {
  AmbiguousPluginMatchError,
  PluginNotInMarketplaceError,
  VersionMismatchError,
} from "../../../../src/domain/errors.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { buildUnitDeps, initAndInstall } from "../../../helpers/ports/build-unit-deps.js";
import type { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { KeepPrompter } from "../../../helpers/ports/scripted-prompter.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const MKT1_DIR = "/mkt1";
const MKT2_DIR = "/mkt2";

function seedMarketplaceFile(
  fs: InMemoryFileAdapter,
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
  const catalogRepo = new PluginCatalogRepositoryAdapter(deps.fs);
  const pluginAdd = new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher
  );
  const useCase = new PluginInstallFromMarketplaceUseCase(
    new ResolveMarketplaceUseCase(deps.pluginFetcher, catalogRepo),
    registry,
    pluginAdd,
    new KeepPrompter()
  );
  return { useCase, deps, registry };
}

describe("PluginInstallFromMarketplaceUseCase", () => {
  it("installs a plugin found in a single marketplace and tags it", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE }, version: "1.0.0" },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    expect(result.marketplace.name).toBe("mkt1");
    const manifest = await deps.manifestRepo.load();
    const plugins = manifest?.getPlugins("claude") ?? [];
    const installed = plugins.find((p) => p.name === "sample-plugin");
    expect(installed?.marketplace).toBe("mkt1");
  });

  it("throws PluginNotInMarketplaceError when no marketplace contains the plugin", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, []);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "missing",
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(PluginNotInMarketplaceError);
  });

  it("throws AmbiguousPluginMatchError on multi-match in non-interactive mode", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    seedMarketplaceFile(deps.fs, MKT1_DIR, [entry]);
    seedMarketplaceFile(deps.fs, MKT2_DIR, [entry]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: MKT2_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(AmbiguousPluginMatchError);
  });

  it("respects the --from filter to disambiguate", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    seedMarketplaceFile(deps.fs, MKT1_DIR, [entry]);
    seedMarketplaceFile(deps.fs, MKT2_DIR, [entry]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: MKT2_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      fromMarketplace: "mkt2",
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    expect(result.marketplace.name).toBe("mkt2");
  });

  it("throws VersionMismatchError when pinned version disagrees with catalog", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE }, version: "2.0.0" },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        version: "1.0.0",
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(VersionMismatchError);
  });

  it("falls back to plugin.json semver when catalog has no version field", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE } },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        version: "9.9.9",
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(VersionMismatchError);
  });

  it("autoSelect resolves multi-match in non-interactive mode", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    seedMarketplaceFile(deps.fs, MKT1_DIR, [entry]);
    seedMarketplaceFile(deps.fs, MKT2_DIR, [entry]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: MKT2_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: false,
      autoSelect: true,
    });

    expect(result.marketplace.name).toBe("mkt1");
  });
});
