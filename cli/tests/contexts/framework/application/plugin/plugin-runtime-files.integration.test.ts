import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { PluginUpdateUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-update-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { buildUnitDeps } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";

const ROOT = "/test-project";
const FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const HELPER = ".opencode/hooks/opencode-events.js";
const USER_CONFIG = '{"model":"user/model","permission":{"bash":"ask"}}';

async function legacyProject() {
  const deps = await buildUnitDeps(ROOT);
  const manifest = Manifest.create();
  manifest.addTool("opencode", "legacy", [
    new InstallationFile({
      relativePath: "opencode.json",
      content: USER_CONFIG,
      hash: deps.hasher.hash(USER_CONFIG),
    }),
  ]);
  await deps.manifestRepo.save(manifest);
  await deps.fs.writeFile(join(ROOT, "opencode.json"), USER_CONFIG);
  await seedFromDirectory(deps.fs, FIXTURE, { useAbsolutePaths: true });
  const add = new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    new PluginDistributionLoader(deps.pluginFetcher, deps.pluginDistributionReader),
    deps.hasher,
    deps.logger,
    deps.marketplaceRegistry,
    fakeEnsureBuiltMarketplace(),
    deps.userManifestRepo,
    deps.installRuntimeConfigUseCase
  );
  const update = new PluginUpdateUseCase(
    deps.fs,
    deps.manifestRepo,
    new PluginDistributionLoader(deps.pluginFetcher, deps.pluginDistributionReader),
    deps.hasher,
    undefined,
    deps.installRuntimeConfigUseCase
  );
  const addPlugin = () =>
    add.execute({
      source: { kind: "local", path: FIXTURE },
      toolIds: ["opencode"],
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
    expect(manifest?.getToolVersion("opencode")).toBe("legacy");
    expect(manifest?.getToolFiles("opencode").map((file) => file.relativePath)).toEqual([
      "opencode.json",
      HELPER,
    ]);
    expect(manifest?.getPlugins("opencode")[0]?.files.has(HELPER)).toBe(false);
  });

  it("backfills during plugin update and retains tool ownership after plugin replacement", async () => {
    const { deps, addPlugin, update } = await legacyProject();
    await addPlugin();
    await deps.fs.deleteFile(join(ROOT, HELPER));
    const manifest = deps.manifestRepo.getCurrent();
    const plugin = manifest?.getPlugins("opencode")[0];
    if (!manifest || !plugin) throw new Error("fixture plugin was not installed");
    manifest.updatePlugin("opencode", plugin.withVersion("0.0.0"));
    await update.execute({ toolIds: ["opencode"], projectRoot: ROOT });
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toContain("setupOpencodeEvents");
    expect(await deps.fs.readFile(join(ROOT, "opencode.json"))).toBe(USER_CONFIG);
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getToolFiles("opencode")
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
        ?.getToolFiles("opencode")
        .some((file) => file.relativePath === HELPER)
    ).toBe(false);
  });

  it("leaves edits to an already tracked helper and its recorded hash intact", async () => {
    const { deps, addPlugin } = await legacyProject();
    await deps.fs.writeFile(join(ROOT, HELPER), "// user's edit");
    const manifest = deps.manifestRepo.getCurrent();
    const originalHash = deps.hasher.hash("// original helper");
    manifest?.updateTrackedFileHash("opencode", HELPER, originalHash);
    await addPlugin();
    expect(await deps.fs.readFile(join(ROOT, HELPER))).toBe("// user's edit");
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getToolFiles("opencode")
        .find((file) => file.relativePath === HELPER)?.hash
    ).toEqual(originalHash);
  });
});
