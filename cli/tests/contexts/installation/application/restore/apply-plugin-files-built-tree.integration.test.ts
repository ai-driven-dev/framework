import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtMaterializationDepsOf } from "../../../../../src/composition/installation.js";
import type { RestoreAllPlugins } from "../../../../../src/contexts/installation/application/restore/restore-all-plugins.use-case.js";
import { fakeEnsureBuiltMarketplace } from "../../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { restoreAllPluginsOf } from "../../testing/build-restore.builder.js";
import { fakeBuildSources, translateDistribution } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

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
    loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
    builtDeps: builtMaterializationDepsOf(deps.fs, {
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: registry,
      homedir,
      platform: process.platform,
      translate: translateDistribution,
    }),
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
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
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

function installedUserPaths(deps: Awaited<ReturnType<typeof buildInstallationDeps>>): string[] {
  const manifest = deps.userManifestRepo.getCurrent();
  if (manifest === null) throw new Error("manifest not found");
  const entry = manifest.getPlugins(TOOL.cursor).find((p) => p.name === "sample-plugin");
  return [...(entry?.files.keys() ?? [])];
}

async function loadedProjectManifest(deps: Awaited<ReturnType<typeof buildInstallationDeps>>) {
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest not found");
  return manifest;
}

function builtSkillContent(deps: Awaited<ReturnType<typeof buildInstallationDeps>>): string {
  const content = deps.fs.getFile(BUILT_SKILL);
  if (content === undefined) throw new Error("built fixture missing");
  return content;
}

describe("RestoreAllPlugins - built-tree materialization", () => {
  it("does not re-materialize a shared user plugin during project restore", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.cursor);
    const registry = await makeRegistry();
    await installMarketplacePlugin(deps, registry);

    const installedRelPaths = installedUserPaths(deps);
    expect(installedRelPaths.length).toBeGreaterThan(0);
    for (const relativePath of installedRelPaths) {
      await deps.fs.deleteFile(join(USER_PLUGINS_DIR, relativePath));
    }

    const manifest = await loadedProjectManifest(deps);
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

    const manifest = await loadedProjectManifest(deps);
    const installedRelPaths = installedUserPaths(deps);
    expect(installedRelPaths.length).toBeGreaterThan(0);
    const builtContent = builtSkillContent(deps);
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
