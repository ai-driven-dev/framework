import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import { RestoreAllPluginsUseCase } from "../../../../../src/contexts/framework/application/restore/restore-all-plugins-use-case.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import { buildUnitDeps, initAndInstall } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const USER_PLUGINS_DIR = join(homedir(), ".cursor/plugins/local");
const BUILT_SKILL = "/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md";

const GIT_SUBDIR_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};

const PLUGIN_METADATA = { name: "sample-plugin", version: "1.0.0", strict: false };

type Deps = Awaited<ReturnType<typeof buildUnitDeps>>;

async function makeRegistry(): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: "aidd-framework",
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "project",
      addedAt: "2026-05-01T00:00:00.000Z",
    })
  );
  return registry;
}

function makeRestoreUseCase(
  deps: Deps,
  registry: InMemoryMarketplaceRegistry
): RestoreAllPluginsUseCase {
  return new RestoreAllPluginsUseCase(
    deps.fs,
    deps.hasher,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    {
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: registry,
      homedir,
    }
  );
}

/** Installs a cursor marketplace plugin so its manifest entry carries `marketplace`. */
async function installMarketplacePlugin(
  deps: Deps,
  registry: InMemoryMarketplaceRegistry
): Promise<void> {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
  deps.fs.setFile(BUILT_SKILL, "# Demo skill");

  await new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher,
    deps.logger,
    registry,
    fakeEnsureBuiltMarketplace(),
    deps.userManifestRepo
  ).execute({
    source: GIT_SUBDIR_SOURCE,
    toolIds: ["cursor"],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    interactive: false,
    pluginMetadata: PLUGIN_METADATA,
  });
}

describe("RestoreAllPluginsUseCase — built-tree materialization", () => {
  it("does not re-materialize a shared user plugin during project restore", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const manifestBefore = deps.userManifestRepo.getCurrent();
    if (manifestBefore === null) throw new Error("manifest not found");
    const installedRelPaths = [
      ...(manifestBefore
        .getPlugins("cursor")
        .find((p) => p.name === "sample-plugin")
        ?.files.keys() ?? []),
    ];
    expect(installedRelPaths.length).toBeGreaterThan(0);
    for (const relativePath of installedRelPaths) {
      await deps.fs.deleteFile(join(USER_PLUGINS_DIR, relativePath));
    }

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const result = await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    expect(result.pluginNames).not.toContain("sample-plugin");
    expect(result.totalFiles).toBe(0);

    for (const relativePath of installedRelPaths) {
      expect(deps.fs.getFile(join(USER_PLUGINS_DIR, relativePath))).toBeUndefined();
      expect(deps.fs.getFile(join(PROJECT_ROOT, relativePath))).toBeUndefined();
    }

    const plugins = manifest.getPlugins("cursor").filter((p) => p.name === "sample-plugin");
    expect(plugins).toHaveLength(1);
    expect(plugins[0].files.size).toBe(0);
  });

  it("reports zero files restored when a built-tree restore finds nothing drifted", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const installedRelPaths = [
      ...(deps.userManifestRepo
        .getCurrent()
        ?.getPlugins("cursor")
        .find((p) => p.name === "sample-plugin")
        ?.files.keys() ?? []),
    ];
    expect(installedRelPaths.length).toBeGreaterThan(0);
    const builtContent = deps.fs.getFile(BUILT_SKILL);
    if (builtContent === undefined) throw new Error("built fixture missing");
    for (const relativePath of installedRelPaths) {
      await deps.fs.writeFile(join(USER_PLUGINS_DIR, relativePath), builtContent);
    }

    const result = await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    expect(result.totalFiles).toBe(0);
    for (const relativePath of installedRelPaths) {
      expect(deps.fs.getFile(join(USER_PLUGINS_DIR, relativePath))).toBe(builtContent);
    }
  });

  it("keeps the manifest's single entry for the plugin after restore (no duplicate registration)", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const before = manifest.getPlugins("cursor").filter((p) => p.name === "sample-plugin");
    expect(before).toHaveLength(1);

    await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    const after = manifest.getPlugins("cursor").filter((p) => p.name === "sample-plugin");
    expect(after).toHaveLength(1);
    expect(after[0].marketplace).toBe("aidd-framework");
  });
});
