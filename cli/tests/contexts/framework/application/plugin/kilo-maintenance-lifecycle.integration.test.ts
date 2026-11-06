import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { assertProjectTuiUnchanged } from "../../../../../src/contexts/framework/application/ownership/project-plugin-cleanup.js";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { PluginUpdateUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-update-use-case.js";
import { SetupToolsUseCase } from "../../../../../src/contexts/framework/application/setup/setup-tools-use-case.js";
import { protectUpgradeWrites } from "../../../../../src/contexts/framework/application/upgrade-file-guard.js";
import { UpgradeFrameworkUseCase } from "../../../../../src/contexts/framework/application/upgrade-framework-use-case.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { buildUnitDeps, initProject } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";

const root = "/project";
const source = "/maintenance";
const config = join(root, ".kilo/tui.jsonc");
const script = join(root, ".kilo/hooks/aidd-maintenance/kilo-tui.js");

async function fixture() {
  const deps = await buildUnitDeps(root);
  await initProject(deps, root);
  await new SetupToolsUseCase(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfigUseCase
  ).execute({ projectRoot: root, aiTools: ["kilo"], ideTools: [], force: false, version: "test" });
  await deps.fs.writeFile(config, '{ // preserve\n "plugin":["./other.js"], "theme":"dark"\n}');
  await deps.fs.writeFile(
    join(source, ".claude-plugin/plugin.json"),
    '{"name":"aidd-maintenance","version":"1.0.0"}'
  );
  await deps.fs.writeFile(join(source, "hooks/kilo-tui.js"), "export default {};");
  await deps.fs.writeFile(join(source, "hooks/session-start.cjs"), "console.log('test')");
  const pluginRoot = "$" + "{CLAUDE_PLUGIN_ROOT}";
  await deps.fs.writeFile(
    join(source, "hooks/hooks.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [{ command: `node "${pluginRoot}/hooks/session-start.cjs"` }],
          },
        ],
      },
    })
  );
  const loader = new PluginDistributionLoader(deps.pluginFetcher, deps.pluginDistributionReader);
  const built = {
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    marketplaceRegistry: deps.marketplaceRegistry,
    homedir: () => "/home/u",
  };
  const add = (fs = deps.fs) =>
    new PluginAddUseCase(
      fs,
      deps.manifestRepo,
      loader,
      deps.hasher,
      deps.logger,
      deps.marketplaceRegistry,
      built.ensureBuilt,
      deps.userManifestRepo
    );
  const update = new PluginUpdateUseCase(deps.fs, deps.manifestRepo, loader, deps.hasher, built);
  const options = {
    source: { kind: "local" as const, path: source },
    toolIds: ["kilo" as const],
    projectRoot: root,
    interactive: false,
  };
  await add().execute(options);
  return { deps, add, update, options };
}

describe("maintenance TUI project lifecycle", () => {
  it("keeps provenance and user JSONC on replacement and version update", async () => {
    const { deps, add, update, options } = await fixture();
    const original = await deps.fs.readFile(config);
    const before = deps.manifestRepo.getCurrent()?.getPlugins("kilo")[0];
    if (!before) throw new Error("missing plugin");
    // The upgrade guard permits only tracked files; unchanged shared JSONC needs no write.
    const guarded = protectUpgradeWrites(deps.fs, root, before.files);
    await add(guarded).execute({ ...options, replace: true });
    expect(await deps.fs.readFile(config)).toBe(original);
    await deps.fs.writeFile(
      join(source, ".claude-plugin/plugin.json"),
      '{"name":"aidd-maintenance","version":"1.0.1"}'
    );
    expect(await update.execute({ toolIds: ["kilo"], projectRoot: root })).toEqual([
      "aidd-maintenance",
    ]);
    expect(await deps.fs.readFile(config)).toBe(original);
    expect(deps.manifestRepo.getCurrent()?.getPlugins("kilo")[0]?.tuiPlugin).toEqual(
      before.tuiPlugin
    );
    expect(await deps.fs.fileExists(script)).toBe(true);
  });

  it("refuses update before deleting files if the user removed the owned entry", async () => {
    const { deps, update } = await fixture();
    await deps.fs.writeFile(config, '{ // preserve\n "plugin":["./other.js"]\n}');
    await deps.fs.writeFile(
      join(source, ".claude-plugin/plugin.json"),
      '{"name":"aidd-maintenance","version":"1.0.1"}'
    );
    await expect(update.execute({ toolIds: ["kilo"], projectRoot: root })).rejects.toThrow(
      "tracked entry was removed"
    );
    expect(await deps.fs.fileExists(script)).toBe(true);
    expect(deps.manifestRepo.getCurrent()?.getPlugins("kilo")[0]?.version).toBe("1.0.0");
  });

  it("rejects a release upgrade before changing its marketplace when TUI ownership was edited", async () => {
    const { deps } = await fixture();
    const manifest = deps.manifestRepo.getCurrent();
    const plugin = manifest?.getPlugins("kilo")[0];
    if (!manifest || !plugin) throw new Error("missing plugin");
    const data = plugin.toJSON();
    data.source = {
      kind: "git-subdir",
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/aidd-maintenance",
      ref: "v1.0.0",
    };
    data.marketplace = "aidd-framework";
    manifest.updatePlugin("kilo", InstalledPlugin.fromJSON(data));
    await deps.fs.writeFile(config, '{"plugin":["./other.js"]}');
    const marketplace = Marketplace.fromJSON({
      name: "aidd-framework",
      source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v1.0.0" },
      scope: "project",
      addedAt: "2026-01-01",
      version: "1.0.0",
    });
    const saveMarketplace = vi.fn(async () => {});
    const install = vi.fn(async () => {});
    const upgrade = new UpgradeFrameworkUseCase({
      listMarketplaces: async () => [marketplace],
      saveMarketplace,
      loadManifest: async () => manifest,
      resolvePublishedRelease: async () => ({ title: "Release title" }),
      resolveTarget: async () => ({
        catalog: {
          version: "1.0.1",
          plugins: [
            {
              name: "aidd-maintenance",
              source: { kind: "local", path: "./plugins/aidd-maintenance" },
            },
          ],
        },
        localPath: "/release",
      }),
      readTargetVersion: async () => "1.0.1",
      preflight: async () => assertProjectTuiUnchanged(deps.fs, plugin, "kilo", root),
      install,
      sync: async () => ({ warnings: [], errors: [], binaryMissing: [] }),
    });
    await expect(
      upgrade.execute({
        projectRoot: root,
        release: "v1.0.1",
        allowShared: true,
        confirm: async () => true,
      })
    ).rejects.toThrow("tracked entry was removed");
    expect(saveMarketplace).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
  });
});
