import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import type { RestoreAllPlugins } from "../../../../../src/contexts/installation/application/restore/restore-all-plugins.js";
import { restoreAllPluginsOf } from "../../../../helpers/ports/build-restore.js";
import {
  fakeBuildSources,
  translateDistribution,
} from "../../../../helpers/ports/fake-build-sources.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";
import { buildInstallationDeps, initAndInstall } from "../../testing/installation-deps.js";

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

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

async function makeRegistry(): Promise<FakeMarketplaceRegistry> {
  const registry = new FakeMarketplaceRegistry();
  registry.seed(PROJECT_ROOT, {
    name: "aidd-framework",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
  });
  return registry;
}

function makeRestoreUseCase(deps: Deps, registry: FakeMarketplaceRegistry): RestoreAllPlugins {
  return restoreAllPluginsOf({
    ...deps,
    builtDeps: {
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: registry,
      homedir,
      platform: process.platform,
      translate: translateDistribution,
    },
  });
}

/** Installs a cursor marketplace plugin so its manifest entry carries `marketplace`. */
async function installMarketplacePlugin(
  deps: Deps,
  registry: FakeMarketplaceRegistry
): Promise<void> {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
  deps.fs.setFile(BUILT_SKILL, "# Demo skill");

  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        deps.pluginDistributionReader
      ),
      marketplaceRegistry: registry,
      ...fakeBuildSources(),
    },
    registeredTools()
  ).execute({
    githubMarketplace: false,
    source: GIT_SUBDIR_SOURCE,
    toolIds: [TOOL.cursor],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    interactive: false,
    pluginMetadata: PLUGIN_METADATA,
  });
}

describe("RestoreAllPlugins — built-tree materialization", () => {
  it("does not re-materialize a shared user plugin during project restore", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.cursor);
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const manifestBefore = deps.userManifestRepo.getCurrent();
    if (manifestBefore === null) throw new Error("manifest not found");
    const installedRelPaths = [
      ...(manifestBefore
        .getPlugins(TOOL.cursor)
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

    const plugins = manifest.getPlugins(TOOL.cursor).filter((p) => p.name === "sample-plugin");
    expect(plugins).toHaveLength(1);
    expect(plugins[0].files.size).toBe(0);
  });

  it("reports zero files restored when a built-tree restore finds nothing drifted", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.cursor);
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const installedRelPaths = [
      ...(deps.userManifestRepo
        .getCurrent()
        ?.getPlugins(TOOL.cursor)
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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.cursor);
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const before = manifest.getPlugins(TOOL.cursor).filter((p) => p.name === "sample-plugin");
    expect(before).toHaveLength(1);

    await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    const after = manifest.getPlugins(TOOL.cursor).filter((p) => p.name === "sample-plugin");
    expect(after).toHaveLength(1);
    expect(after[0].marketplace).toBe("aidd-framework");
  });
});
