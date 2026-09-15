import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import { UserPluginDistributionLoader } from "../../../../../src/contexts/framework/application/ownership/user-plugin-distribution-loader.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../../../../../src/contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import { buildUnitDeps, initAndInstall } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const HOME = "/home/u";
/** Where cursor's PluginsCapability resolves user-scope plugin writes to. */
const USER_PLUGINS_DIR = join(HOME, ".cursor/plugins/local");
const BUILT_SKILL = "/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md";

const GIT_SUBDIR_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};

const PLUGIN_METADATA = { name: "sample-plugin", version: "1.0.0", strict: false };

type Deps = Awaited<ReturnType<typeof buildUnitDeps>>;

async function makeRegistry(): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: "aidd-framework",
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "project",
      addedAt: "2026-05-01T00:00:00.000Z",
    })
  );
  return registry;
}

function makeUpdateUseCase(
  deps: Deps,
  registry: InMemoryMarketplaceRegistry
): UserPluginUpdateUseCase {
  return new UserPluginUpdateUseCase(
    deps.userManifestRepo,
    new UserPluginFileUpdater(
      deps.fs,
      new UserPluginDistributionLoader(
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs)
      ),
      deps.hasher,
      {
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        marketplaceRegistry: registry,
        homedir: () => HOME,
      }
    ),
    deps.logger,
    new NativeHostRegistrationGate(new Map(), new Map())
  );
}

/** Installs a cursor marketplace plugin, then lowers its recorded version so update re-materializes. */
async function installStalePlugin(
  deps: Deps,
  registry: InMemoryMarketplaceRegistry
): Promise<void> {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
  deps.fs.setFile(BUILT_SKILL, "# Demo skill");

  await new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher,
    deps.logger,
    registry,
    fakeEnsureBuiltMarketplace(),
    deps.userManifestRepo
  ).execute({
    source: GIT_SUBDIR_SOURCE,
    toolIds: ["cursor"],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    interactive: false,
    pluginMetadata: PLUGIN_METADATA,
  });

  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest not found");
  const plugin = manifest.getPlugins("cursor").find((p) => p.name === "sample-plugin");
  if (plugin === undefined) throw new Error("plugin not found");
  manifest.updatePlugin("cursor", plugin.withVersion("0.0.1"));
  await deps.manifestRepo.save(manifest);
  const machine = deps.userManifestRepo.getCurrent();
  if (machine === null) throw new Error("user manifest not found");
  const owned = machine.getPlugins("cursor").find((p) => p.name === "sample-plugin");
  if (owned === undefined) throw new Error("machine plugin not found");
  machine.updatePlugin("cursor", owned.withVersion("0.0.1"));
  await deps.userManifestRepo.save(machine);
}

describe("PluginUpdateUseCase — built-tree materialization", () => {
  it("re-materializes from the built tree for a marketplace plugin", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);

    deps.fs.setFile(BUILT_SKILL, "# Demo skill v2");

    const updated = await makeUpdateUseCase(deps, registry).execute({
      toolIds: ["cursor"],
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(updated).toContain("sample-plugin");
    const manifest = deps.userManifestRepo.getCurrent();
    const plugin = manifest?.getPlugins("cursor").find((p) => p.name === "sample-plugin");
    expect(plugin?.version).toBe("1.0.0");
    expect(plugin?.files.size).toBeGreaterThan(0);
    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Demo skill v2"
    );
  });

  it("writes the updated plugin under the user-scope base dir, not the project root", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);

    await makeUpdateUseCase(deps, registry).execute({
      toolIds: ["cursor"],
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    const manifest = deps.userManifestRepo.getCurrent();
    const plugin = manifest?.getPlugins("cursor").find((p) => p.name === "sample-plugin");
    const written = [...(plugin?.files.keys() ?? [])];
    expect(written.length).toBeGreaterThan(0);
    for (const relativePath of written) {
      expect(deps.fs.getFile(join(USER_PLUGINS_DIR, relativePath))).toBeDefined();
      expect(deps.fs.getFile(join(PROJECT_ROOT, relativePath))).toBeUndefined();
    }
  });

  it("does not rewrite or advance a plugin already at the fetched version", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const machine = deps.userManifestRepo.getCurrent();
    const stale = machine?.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin");
    if (machine === null || stale === undefined) throw new Error("fixture missing plugin");
    machine.updatePlugin("cursor", stale.withVersion("1.0.0"));
    const savesBefore = deps.userManifestRepo.saveCount;
    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual([]);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(machine.getPlugins("cursor")[0]?.version).toBe("1.0.0");
  });

  it("refuses an escaped old user file before writing a fetched build or changing its claim", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const foreign = "/foreign/sample-plugin";
    const dir = join(USER_PLUGINS_DIR, "sample-plugin");
    deps.fs.setSymlink(dir, foreign);
    deps.fs.setFile(join(foreign, "skills/demo/SKILL.md"), "foreign bytes");
    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/unsafe recorded files/);
    expect(deps.fs.getFile(join(foreign, "skills/demo/SKILL.md"))).toBe("foreign bytes");
    expect(deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0]?.version).toBe("0.0.1");
  });

  it("prunes only old owned paths and keeps dependent roots when replacing the user files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const machine = deps.userManifestRepo.getCurrent();
    const stale = machine?.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin");
    if (machine === null || stale === undefined) throw new Error("fixture missing plugin");
    const oldPath = "sample-plugin/skills/obsolete/SKILL.md";
    const oldAbsolute = join(USER_PLUGINS_DIR, oldPath);
    deps.fs.setFile(oldAbsolute, "old owned bytes");
    machine.updatePlugin(
      "cursor",
      stale
        .withFiles(new Map([...stale.files, [oldPath, deps.hasher.hash("old owned bytes").value]]))
        .withDependents([PROJECT_ROOT, "/B"])
    );
    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);
    expect(deps.fs.getFile(oldAbsolute)).toBeUndefined();
    const owned = deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0];
    expect(owned?.dependents).toEqual([PROJECT_ROOT, "/B"]);
    expect(owned?.files.has(oldPath)).toBe(false);
  });

  it("translates a local user plugin without taking an unrelated marketplace's built tree", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromMetadata(
        "sample-plugin",
        "0.0.1",
        { kind: "local", path: PLUGIN_FIXTURE },
        false,
        "user"
      ).withDependents([PROJECT_ROOT])
    );
    await deps.userManifestRepo.save(machine);
    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);
    const owned = deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0];
    expect(owned?.version).toBe("1.0.0");
    expect(owned?.dependents).toEqual([PROJECT_ROOT]);
    expect(owned?.files.size).toBeGreaterThan(0);
    expect([...(owned?.files.keys() ?? [])].some((path) => path.includes("skills/hello"))).toBe(
      true
    );
    expect([...(owned?.files.keys() ?? [])].some((path) => path.includes("hooks/"))).toBe(false);
    expect(
      deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))
    ).toBeUndefined();
  });
});
