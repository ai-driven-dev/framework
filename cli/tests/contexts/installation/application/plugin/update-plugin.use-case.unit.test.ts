import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import {
  UpdatePlugin,
  type UpdatePluginDeps,
} from "../../../../../src/contexts/installation/application/plugin/update-plugin.use-case.js";
import type { RuntimeConfigSection } from "../../../../../src/contexts/installation/ports/tool-sections.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources, fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");

async function installedSample(pluginRuntime?: UpdatePluginRuntime) {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const loader = new PluginDistributionLoader(deps.pluginFetcher, deps.pluginDistributionReader);
  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: loader,
      marketplaceRegistry: deps.marketplaceRegistry,
      ...fakeBuildSources(),
    },
    registeredTools()
  ).execute({
    githubMarketplace: false,
    source: { kind: "local", path: PLUGIN_FIXTURE },
    toolIds: [TOOL.claude],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
  const update = new UpdatePlugin(
    {
      manifestRepo: deps.manifestRepo,
      distributionLoader: loader,
      replacePluginFiles: new ReplacePluginFiles(
        deps.fs,
        fakeBuiltDeps(deps.fs),
        registeredTools()
      ),
      pluginRuntime,
    },
    registeredTools()
  );
  return { deps, update };
}

type UpdatePluginRuntime = UpdatePluginDeps["pluginRuntime"];

describe("UpdatePlugin", () => {
  it("leaves user scope to UpdateUserPluginFiles", async () => {
    const { update } = await installedSample();

    await expect(
      update.execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT, scope: "user" })
    ).rejects.toThrow("User-scope plugin update requires UpdateUserPluginFiles.");
  });

  it("leaves a plugin alone when its source is not newer", async () => {
    const { deps, update } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);

    const updated = await update.execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT });

    expect([updated, deps.fs.has(GREET_PATH)]).toStrictEqual([[], false]);
  });

  it("re-materializes a plugin at the same version when rebuild is asked", async () => {
    const { deps, update } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);

    const updated = await update.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      rebuild: true,
    });

    expect([updated, deps.fs.has(GREET_PATH)]).toStrictEqual([["sample-plugin"], true]);
  });

  it("refreshes the tool's runtime files even when the plugin is current", async () => {
    const seen: string[] = [];
    const { update } = await installedSample({
      ensurePluginRuntimeFiles: async (tool: RuntimeConfigSection) => {
        seen.push(tool.toolId);
      },
    });

    await update.execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT });

    expect(seen).toStrictEqual([TOOL.claude]);
  });
});
