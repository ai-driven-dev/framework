import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlacePlugin } from "../../../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import { ResolveAddedPluginSource } from "../../../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../../shared/testing/seed-from-directory.builder.js";
import { fakeBuildSources } from "../../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";
const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
const SOURCE = { kind: "local" as const, path: PLUGIN_FIXTURE };

async function placeForClaude() {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const built = { ...fakeBuildSources(), marketplaceRegistry: deps.marketplaceRegistry };
  const platform = { homedir: () => "/home/u", platform: process.platform };
  const added = await new ResolveAddedPluginSource(
    {
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
      fs: deps.fs,
      built: { ...built, ...platform },
    },
    registeredTools()
  ).execute({
    source: SOURCE,
    projectRoot: PROJECT_ROOT,
    toolIds: [TOOL.claude],
    githubMarketplace: false,
  });
  if (added.isGithubMarketplace) throw new Error("a local add reads its distribution");
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("the project manifest was not initialised");
  const logger = new CapturingLogger();
  const refreshed: string[] = [];
  await new PlacePlugin(
    {
      fs: deps.fs,
      logger,
      built: { ...built, ...platform },
      pluginRuntime: {
        ensurePluginRuntimeFiles: async (tool) => {
          refreshed.push(tool.toolId);
        },
      },
    },
    registeredTools()
  ).execute({
    dist: added.distribution,
    toolIds: [TOOL.claude],
    source: SOURCE,
    projectRoot: PROJECT_ROOT,
    manifest,
    machine: Manifest.create(),
    marketplace: undefined,
    previousMcpEntries: new Map(),
    previousProjectHooks: new Map(),
  });
  return { deps, manifest, refreshed };
}

describe("PlacePlugin", () => {
  it("writes the plugin's files and records the plugin in the project manifest", async () => {
    const { deps, manifest } = await placeForClaude();

    const plugin = manifest.getPlugins(TOOL.claude).find((p) => p.name === "sample-plugin");
    expect([deps.fs.has(GREET_PATH), plugin?.scope]).toStrictEqual([true, "project"]);
  });

  it("refreshes the runtime files of each tool it places for", async () => {
    const { refreshed } = await placeForClaude();

    expect(refreshed).toStrictEqual([TOOL.claude]);
  });
});
