import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import type { UpdateProjectPluginsDeps } from "../../../../../src/contexts/installation/application/plugin/update-project-plugins.use-case.js";
import type { RuntimeConfigSection } from "../../../../../src/contexts/installation/ports/tool-sections.js";
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

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");

async function installedSample(pluginRuntime?: UpdatePluginRuntime) {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const loader = loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader);
  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      loadDistribution: loader,
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
  const update = buildProjectPluginUpdate(
    {
      manifestRepo: deps.manifestRepo,
      loadDistribution: loader,
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

type UpdatePluginRuntime = UpdateProjectPluginsDeps["pluginRuntime"];

describe("updating a plugin in a project", () => {
  it("leaves a plugin alone when its source is not newer", async () => {
    const { deps, update } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);

    const updated = await update.execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT });

    expect([updated, deps.fs.has(GREET_PATH)]).toStrictEqual([[], false]);
  });

  it("saves the project manifest once the tools were updated", async () => {
    const { deps, update } = await installedSample();
    const before = deps.manifestRepo.saveCount;

    await update.execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT });

    expect(deps.manifestRepo.saveCount).toBe(before + 1);
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
      execute: async (tool: RuntimeConfigSection) => {
        seen.push(tool.toolId);
      },
    });

    await update.execute({ toolIds: [TOOL.claude], projectRoot: PROJECT_ROOT });

    expect(seen).toStrictEqual([TOOL.claude]);
  });
});
