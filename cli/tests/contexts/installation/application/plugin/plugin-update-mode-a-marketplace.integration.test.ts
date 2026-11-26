import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtPlacementOf } from "../../../../../src/composition/orchestration/built-placement.js";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import type { UpdatePlugin } from "../../../../../src/contexts/installation/application/plugin/update-plugin.use-case.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { buildProjectPluginUpdate } from "../../testing/build-update-plugin.builder.js";
import { fakeBuildSources, fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const HOME = "/home/u";
// Skills nest under <plugin>/ in the built tree (agents stay hyphen-namespaced).
const BUILT_OPENCODE_SKILL = "/built/opencode/.opencode/skills/sample-plugin/demo/SKILL.md";

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

function makeUpdateUseCase(deps: Deps, registry: FakeMarketplaceRegistry): UpdatePlugin {
  return buildProjectPluginUpdate(
    {
      manifestRepo: deps.manifestRepo,
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
      replacePluginFiles: new ReplacePluginFiles(
        {
          fs: deps.fs,
          ...builtPlacementOf(
            deps.fs,
            fakeBuiltDeps({ marketplaceRegistry: registry, homedir: () => HOME })
          ),
        },
        registeredTools()
      ),
    },
    registeredTools()
  );
}

/** Installs a github-sourced marketplace plugin on `toolId`, then lowers its recorded
 * version so update sees it as stale and re-fetches. */
async function installStaleGithubPlugin(
  deps: Deps,
  registry: FakeMarketplaceRegistry,
  toolId: AiToolId
): Promise<void> {
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
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    githubMarketplace: true,
    interactive: false,
    pluginMetadata: PLUGIN_METADATA,
  });

  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest not found");
  const plugin = manifest.getRecordedPlugins(toolId).find((p) => p.plugin.name === "sample-plugin");
  if (plugin === undefined) throw new Error("plugin not found");
  manifest.updatePlugin(toolId, plugin.withPlugin(plugin.plugin.withVersion("0.0.1")));
  await deps.manifestRepo.save(manifest);
}

describe("UpdatePlugin - Mode A marketplace tools (claude/codex/copilot)", () => {
  it("updates a github-sourced marketplace plugin on claude without materializing any files", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const registry = await makeGithubRegistry();
    await installStaleGithubPlugin(deps, registry, TOOL.claude);

    const beforeManifest = await deps.manifestRepo.load();
    const before = beforeManifest
      ?.getRecordedPlugins(TOOL.claude)
      .find((p) => p.plugin.name === "sample-plugin");
    expect(before?.plugin.files.size).toBe(0);
    expect(deps.fs.listAll().some((p) => p.includes(".claude/plugins/"))).toBe(false);

    const { updated } = await makeUpdateUseCase(deps, registry).execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(updated).toContain("sample-plugin");
    const manifest = await deps.manifestRepo.load();
    const plugin = manifest
      ?.getRecordedPlugins(TOOL.claude)
      .find((p) => p.plugin.name === "sample-plugin");
    expect(plugin?.plugin.version).toBe("1.0.0");
    // Mode A's whole contract: register the reference, materialize nothing. Update must
    // not write plugin files that install never wrote, nor record them in the manifest.
    expect(plugin?.plugin.files.size).toBe(0);
    expect(deps.fs.listAll().some((p) => p.includes(".claude/plugins/"))).toBe(false);
  });

  it("keeps the manifest's single entry for the plugin after update (no duplicate registration)", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const registry = await makeGithubRegistry();
    await installStaleGithubPlugin(deps, registry, TOOL.claude);

    await makeUpdateUseCase(deps, registry).execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    const manifest = await deps.manifestRepo.load();
    const plugins =
      manifest?.getRecordedPlugins(TOOL.claude).filter((p) => p.plugin.name === "sample-plugin") ??
      [];
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.marketplace).toBe("aidd-framework");
    expect(plugins[0]?.plugin.source.kind).toBe("git-subdir");
  });
});

describe("UpdatePlugin - flat-mode tools are unaffected (regression guard)", () => {
  it("still re-materializes opencode's flat files from the built tree on update", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.opencode);
    const registry = await makeGithubRegistry();
    await installStaleGithubPlugin(deps, registry, TOOL.opencode);
    deps.fs.setFile(BUILT_OPENCODE_SKILL, "# Demo skill v2");

    const { updated } = await makeUpdateUseCase(deps, registry).execute({
      toolIds: [TOOL.opencode],
      projectRoot: PROJECT_ROOT,
    });

    expect(updated).toContain("sample-plugin");
    const manifest = await deps.manifestRepo.load();
    const plugin = manifest
      ?.getRecordedPlugins(TOOL.opencode)
      .find((p) => p.plugin.name === "sample-plugin");
    expect(plugin?.plugin.version).toBe("1.0.0");
    expect(plugin?.plugin.files.size).toBeGreaterThan(0);
    expect(
      deps.fs.getFile(join(PROJECT_ROOT, ".opencode/skills/sample-plugin/demo/SKILL.md"))
    ).toBe("# Demo skill v2");
  });
});
