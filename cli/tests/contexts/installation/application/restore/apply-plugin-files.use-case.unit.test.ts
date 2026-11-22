import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApplyPluginFiles } from "../../../../../src/contexts/installation/application/restore/apply-plugin-files.use-case.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources, fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");

async function installedSample() {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
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
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("the project manifest was not initialised");
  const plugin = present(manifest.getRecordedPlugins(TOOL.claude)[0]);
  const apply = new ApplyPluginFiles({
    fs: deps.fs,
    loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
    builtDeps: fakeBuiltDeps(deps.fs),
  });
  const command = {
    toolId: TOOL.claude,
    plugin,
    tool: registeredTools().aiProfile(TOOL.claude),
    projectRoot: PROJECT_ROOT,
    cacheDir: "/cache",
    manifest,
  };
  return { deps, apply, command };
}

describe("ApplyPluginFiles", () => {
  it("rewrites a file that is missing and counts it", async () => {
    const { deps, apply, command } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);

    const restored = await apply.execute({ ...command, fileFilter: () => true });

    expect([restored, deps.fs.has(GREET_PATH)]).toStrictEqual([1, true]);
  });

  it("counts nothing when every file is already as installed", async () => {
    const { apply, command } = await installedSample();

    expect(await apply.execute({ ...command, fileFilter: () => true })).toBe(0);
  });

  it("leaves the files the filter refuses", async () => {
    const { deps, apply, command } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);

    const restored = await apply.execute({ ...command, fileFilter: () => false });

    expect([restored, deps.fs.has(GREET_PATH)]).toStrictEqual([0, false]);
  });

  it("leaves a user-scope plugin to its own restore", async () => {
    const { deps, apply, command } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);
    const plugin = RecordedPlugin.fromJSON({ ...command.plugin.toJSON(), scope: "user" });

    const restored = await apply.execute({ ...command, plugin, fileFilter: () => true });

    expect([restored, deps.fs.has(GREET_PATH)]).toStrictEqual([0, false]);
  });
});
