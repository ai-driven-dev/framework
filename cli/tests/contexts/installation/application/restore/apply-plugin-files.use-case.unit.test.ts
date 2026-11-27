import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtPlacementOf } from "../../../../../src/composition/orchestration/built-placement.js";
import { ApplyPluginFiles } from "../../../../../src/contexts/installation/application/restore/apply-plugin-files.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
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

async function installedSample(toolId = TOOL.claude) {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, toolId);
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
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("the project manifest was not initialised");
  const plugin = present(manifest.getRecordedPlugins(toolId)[0]);
  const apply = new ApplyPluginFiles({
    fs: deps.fs,
    loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
    ...builtPlacementOf(deps.fs, fakeBuiltDeps()),
  });
  const command = {
    toolId,
    plugin,
    tool: registeredTools().aiProfile(toolId),
    projectRoot: PROJECT_ROOT,
    cacheDir: "/cache",
    manifest,
    machine: Manifest.create(),
  };
  return { deps, apply, command };
}

describe("applying a plugin's files", () => {
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

  it("leaves the files the filter refuses on a tool that takes its hooks into the project", async () => {
    const { deps, apply, command } = await installedSample(TOOL.antigravity);
    const [relativePath] = [...command.plugin.plugin.files.keys()];
    const path = join(PROJECT_ROOT, relativePath);
    await deps.fs.deleteFile(path);

    const restored = await apply.execute({ ...command, fileFilter: () => false });

    expect([restored, deps.fs.has(path)]).toStrictEqual([0, false]);
  });

  it("leaves a user-scope plugin to its own restore", async () => {
    const { deps, apply, command } = await installedSample();
    await deps.fs.deleteFile(GREET_PATH);
    const plugin = RecordedPlugin.fromJSON({ ...command.plugin.toJSON(), scope: "user" });

    const restored = await apply.execute({ ...command, plugin, fileFilter: () => true });

    expect([restored, deps.fs.has(GREET_PATH)]).toStrictEqual([0, false]);
  });
});
