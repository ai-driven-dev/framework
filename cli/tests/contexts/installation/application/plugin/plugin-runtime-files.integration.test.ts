import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { UpdatePlugin } from "../../../../../src/contexts/installation/application/plugin/update-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { buildInstallationDeps } from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { REPOSITORY_ROOT } from "../../../../shared/testing/repository-root.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources, fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const ROOT = "/test-project";
const FIXTURE = join(REPOSITORY_ROOT, "cli/tests/fixtures/plugins/claude-format/sample-plugin");
const HELPER = ".opencode/hooks/opencode-events.js";
const USER_CONFIG = '{"model":"user/model","permission":{"bash":"ask"}}';

async function legacyProject() {
  const deps = await buildInstallationDeps();
  const manifest = Manifest.create();
  manifest.addTool(TOOL.opencode, "legacy", [
    new InstallationFile({
      relativePath: "opencode.json",
      content: USER_CONFIG,
      hash: FileHash.of(USER_CONFIG),
    }),
  ]);
  await deps.manifestRepo.save(manifest);
  await deps.fs.writeFile(join(ROOT, "opencode.json"), USER_CONFIG);
  await seedFromDirectory(deps.fs, FIXTURE, { useAbsolutePaths: true });
  const add = buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        deps.pluginDistributionReader
      ),
      marketplaceRegistry: deps.marketplaceRegistry,
      ...fakeBuildSources(),
    },
    registeredTools(),
    deps.installRuntimeConfigUseCase
  );
  const update = new UpdatePlugin(
    deps.manifestRepo,
    new PluginDistributionLoader(deps.pluginFetcher, deps.pluginDistributionReader),
    new ReplacePluginFiles(deps.fs, fakeBuiltDeps(), registeredTools()),
    registeredTools(),
    deps.installRuntimeConfigUseCase
  );
  const addPlugin = () =>
    add.execute({
      githubMarketplace: false,
      source: { kind: "local", path: FIXTURE },
      toolIds: [TOOL.opencode],
      projectRoot: ROOT,
      interactive: false,
    });
  return { deps, addPlugin, update };
}

describe("plugin runtime files on an existing tool", () => {
  it("backfills a missing shared adapter during plugin install without replacing user configuration", async () => {
    const { deps, addPlugin } = await legacyProject();
    await addPlugin();
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toContain("setupOpencodeEvents");
    expect(await deps.fs.readFile(join(ROOT, "opencode.json"))).toBe(USER_CONFIG);
    const manifest = deps.manifestRepo.getCurrent();
    expect(manifest?.getToolVersion(TOOL.opencode)).toBe("legacy");
    expect(manifest?.getToolFiles(TOOL.opencode).map((file) => file.relativePath)).toEqual([
      "opencode.json",
      HELPER,
    ]);
    expect(manifest?.getPlugins(TOOL.opencode)[0]?.files.has(HELPER)).toBe(false);
  });

  it("backfills during plugin update and retains tool ownership after plugin replacement", async () => {
    const { deps, addPlugin, update } = await legacyProject();
    await addPlugin();
    await deps.fs.deleteFile(join(ROOT, HELPER));
    const manifest = deps.manifestRepo.getCurrent();
    const plugin = manifest?.getPlugins(TOOL.opencode)[0];
    if (!manifest || !plugin) throw new Error("fixture plugin was not installed");
    manifest.updatePlugin(TOOL.opencode, plugin.withVersion("0.0.0"));
    await update.execute({
      toolIds: [TOOL.opencode],
      projectRoot: ROOT,
    });
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toContain("setupOpencodeEvents");
    expect(await deps.fs.readFile(join(ROOT, "opencode.json"))).toBe(USER_CONFIG);
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getToolFiles(TOOL.opencode)
        .filter((file) => file.relativePath === HELPER)
    ).toHaveLength(1);
  });

  it("restores a missing helper when the plugin version is already current", async () => {
    const { deps, addPlugin, update } = await legacyProject();
    await addPlugin();
    const plugin = deps.manifestRepo.getCurrent()?.getPlugins(TOOL.opencode)[0];
    await deps.fs.deleteFile(join(ROOT, HELPER));

    expect(
      await update.execute({
        toolIds: [TOOL.opencode],
        projectRoot: ROOT,
      })
    ).toEqual([]);
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toContain("setupOpencodeEvents");
    expect(await deps.fs.readFile(join(ROOT, "opencode.json"))).toBe(USER_CONFIG);
    expect(deps.manifestRepo.getCurrent()?.getPlugins(TOOL.opencode)[0]).toEqual(plugin);
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getToolFiles(TOOL.opencode)
        .filter((file) => file.relativePath === HELPER)
    ).toHaveLength(1);
  });

  it("preserves and does not claim an existing untracked helper", async () => {
    const { deps, addPlugin } = await legacyProject();
    await deps.fs.writeFile(join(ROOT, HELPER), "// user's helper");
    await addPlugin();
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toBe("// user's helper");
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getToolFiles(TOOL.opencode)
        .some((file) => file.relativePath === HELPER)
    ).toBe(false);
  });

  it("leaves edits to an already tracked helper and its recorded hash intact", async () => {
    const { deps, addPlugin } = await legacyProject();
    await deps.fs.writeFile(join(ROOT, HELPER), "// user's edit");
    const manifest = deps.manifestRepo.getCurrent();
    const originalHash = FileHash.of("// original helper");
    manifest?.recordFileHash(TOOL.opencode, HELPER, originalHash);
    await addPlugin();
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toBe("// user's edit");
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getToolFiles(TOOL.opencode)
        .find((file) => file.relativePath === HELPER)?.hash
    ).toEqual(originalHash);
  });
});
