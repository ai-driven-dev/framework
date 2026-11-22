import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectHooksMaterializer } from "../../../../../src/contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
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
const HOME = "/home/u";

// A plugin whose catalog entry resolves to a github-hosted source (git-subdir), the shape
// PluginInstallFromMarketplaceUseCase produces for any plugin catalogued in a github marketplace.
const GIT_SUBDIR_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};

const PLUGIN_METADATA = { name: "sample-plugin", version: "1.0.0", strict: false };

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

async function makeGithubRegistry(): Promise<FakeMarketplaceRegistry> {
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
    builtDeps: {
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: registry,
      platform: process.platform,
      homedir: () => HOME,
      translate: translateDistribution,
      projectHooks: new ProjectHooksMaterializer(deps.fs),
    },
  });
}

/** Installs a github-sourced marketplace plugin on claude, so its manifest entry carries
 * both `marketplace` and a non-local `source.kind`. */
async function installGithubPlugin(deps: Deps, registry: FakeMarketplaceRegistry): Promise<void> {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);

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
    source: GIT_SUBDIR_SOURCE,
    toolIds: [TOOL.claude],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    githubMarketplace: true,
    interactive: false,
    pluginMetadata: PLUGIN_METADATA,
  });
}

describe("RestoreAllPlugins - Mode A marketplace tools (claude/codex/copilot)", () => {
  it("cleans up files a pre-fix update/restore materialized, leaving the manifest entry empty", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const registry = await makeGithubRegistry();
    await installGithubPlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const plugin = manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin");
    if (plugin === undefined) throw new Error("plugin not found");

    // Files materialized and recorded on the manifest entry, though Mode A's own contract
    // is register-only.
    const strayFiles = new Map([
      [".claude/plugins/sample-plugin/commands/greet.md", "stray-hash-1"],
      [".claude/plugins/sample-plugin/agents/reviewer.md", "stray-hash-2"],
    ]);
    manifest.updatePlugin(TOOL.claude, plugin.withFiles(strayFiles));
    for (const relativePath of strayFiles.keys()) {
      await deps.fs.writeFile(join(PROJECT_ROOT, relativePath), "stray content");
    }

    const result = await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    for (const relativePath of strayFiles.keys()) {
      expect(deps.fs.getFile(join(PROJECT_ROOT, relativePath))).toBeUndefined();
    }
    const after = manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin");
    expect(after?.files.size).toBe(0);
    expect(result.totalFiles).toBe(0);
  });

  it("leaves a file the manifest never tracked untouched, even inside the plugin's own directory", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const registry = await makeGithubRegistry();
    await installGithubPlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const plugin = manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin");
    if (plugin === undefined) throw new Error("plugin not found");

    const trackedPath = ".claude/plugins/sample-plugin/commands/greet.md";
    const untrackedPath = ".claude/plugins/sample-plugin/notes.md";
    manifest.updatePlugin(TOOL.claude, plugin.withFiles(new Map([[trackedPath, "stray-hash"]])));
    await deps.fs.writeFile(join(PROJECT_ROOT, trackedPath), "stray content");
    // Not in the manifest entry - a file placed alongside the plugin's tracked ones, which
    // the cleanup must never delete, since it only iterates the manifest's own keys.
    await deps.fs.writeFile(join(PROJECT_ROOT, untrackedPath), "keep me");

    await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    expect(deps.fs.getFile(join(PROJECT_ROOT, trackedPath))).toBeUndefined();
    expect(deps.fs.getFile(join(PROJECT_ROOT, untrackedPath))).toBe("keep me");
  });

  it("restores a github-sourced marketplace plugin on claude without materializing any files", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const registry = await makeGithubRegistry();
    await installGithubPlugin(deps, registry);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const before = manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin");
    expect(before?.files.size).toBe(0);

    const result = await makeRestoreUseCase(deps, registry).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      fileFilter: null,
    });

    // Mode A's whole contract: register the reference, materialize nothing. Restore must
    // not write plugin files that install never wrote, nor record them in the manifest.
    expect(result.totalFiles).toBe(0);
    expect(deps.fs.listAll().some((p) => p.includes(".claude/plugins/"))).toBe(false);

    const plugins = manifest.getPlugins(TOOL.claude).filter((p) => p.name === "sample-plugin");
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.files.size).toBe(0);
    expect(plugins[0]?.marketplace).toBe("aidd-framework");
    expect(plugins[0]?.source.kind).toBe("git-subdir");
  });
});
