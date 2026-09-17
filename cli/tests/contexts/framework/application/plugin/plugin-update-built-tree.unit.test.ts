import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import { UserPluginDistributionLoader } from "../../../../../src/contexts/framework/application/ownership/user-plugin-distribution-loader.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../../../../../src/contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import type { EnsureBuiltMarketplace } from "../../../../../src/contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import { buildUnitDeps, initAndInstall } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
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
  registry: InMemoryMarketplaceRegistry,
  nativeHost: NativeHostRegistrationGate = new NativeHostRegistrationGate(new Map(), new Map()),
  ensureBuilt: EnsureBuiltMarketplace = fakeEnsureBuiltMarketplace()
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
        ensureBuilt,
        marketplaceRegistry: registry,
        homedir: () => HOME,
      }
    ),
    deps.logger,
    nativeHost
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
  // The fake built-tree install records this file but its test adapter does not deliver it.
  // Supply the recorded install bytes so the provenance guard has a real current file.
  deps.fs.setFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"), "# Demo skill");
  machine.updatePlugin("cursor", owned.withVersion("0.0.1"));
  await deps.userManifestRepo.save(machine);
}

function attachFutureSupportedNativeClaim(deps: Deps) {
  const machine = deps.userManifestRepo.getCurrent();
  if (machine === null) throw new Error("fixture missing machine manifest");
  machine.addTool("copilot", "future-supported", []);
  machine.setNativeRegistrations("copilot", {
    binary: "copilot",
    marketplaces: [
      {
        alias: "aidd-catalog",
        hostName: "aidd-catalog",
        provenance: { kind: "registry", source: "/aidd/catalog" },
      },
    ],
    pluginRefs: ["native-plugin@aidd-catalog"],
    pluginClaims: [{ ref: "native-plugin@aidd-catalog", dependents: [PROJECT_ROOT] }],
  });
  const activator = new FakeNativePluginActivator({ available: true });
  const nativeHost = new NativeHostRegistrationGate(
    new Map([["copilot", activator]]),
    new Map([
      [
        "copilot",
        {
          read: async () => ({
            location: "/host/plugin-registry",
            refs: new Map([
              ["native-plugin@aidd-catalog", { enabled: true, scope: "user" as const }],
            ]),
          }),
        },
      ],
    ]),
    new Map([
      [
        "copilot",
        {
          read: async () => ({
            location: "/verified/future/host-source-port",
            entries: new Map([
              ["aidd-catalog", { kind: "registry" as const, source: "/aidd/catalog" }],
            ]),
          }),
        },
      ],
    ])
  );
  return { machine, activator, nativeHost };
}

describe("PluginUpdateUseCase — built-tree materialization", () => {
  it("refuses an absent machine manifest before touching user files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const registry = await makeRegistry();
    await deps.userManifestRepo.delete();
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    deps.fs.setFile(path, "user bytes");
    const savesBefore = deps.userManifestRepo.saveCount;

    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/No machine manifest.*ownership/);

    expect(deps.userManifestRepo.getCurrent()).toBeNull();
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.fs.getFile(path)).toBe("user bytes");
  });

  it("checks current user bytes inside the machine repository's exclusive-access boundary", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    const before = deps.userManifestRepo.getCurrent()?.toJSON();
    const savesBefore = deps.userManifestRepo.saveCount;
    let acquired = false;
    Object.assign(deps.userManifestRepo, {
      withExclusiveAccess: async (operation: () => Promise<string[]>) => {
        acquired = true;
        deps.fs.setFile(path, "user edit at lock acquisition");
        return operation();
      },
    });

    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/edited after install/);

    expect(acquired).toBe(true);
    expect(deps.fs.getFile(path)).toBe("user edit at lock acquisition");
    expect(deps.userManifestRepo.getCurrent()?.toJSON()).toStrictEqual(before);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
  });

  it.each([{ dependents: [] }, { dependents: [PROJECT_ROOT, "/B"] }])(
    "warns only for actual dependent projects when updating shared native and file plugins: $dependents",
    async ({ dependents }) => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "cursor");
      const registry = await makeRegistry();
      await installStalePlugin(deps, registry);
      const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
      const owned = machine.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin");
      const native = machine.getNativeRegistrations("copilot");
      if (owned === undefined || native === undefined)
        throw new Error("fixture missing selected claims");
      machine.updatePlugin("cursor", owned.withDependents(dependents));
      machine.setNativeRegistrations("copilot", {
        ...native,
        pluginClaims: [{ ref: "native-plugin@aidd-catalog", dependents }],
      });
      const warnings = vi.spyOn(deps.logger, "warn").mockImplementation(() => {});

      expect(
        await makeUpdateUseCase(deps, registry, nativeHost).execute({
          toolIds: ["copilot", "cursor"],
          projectRoot: PROJECT_ROOT,
          scope: "user",
        })
      ).toStrictEqual(["native-plugin@aidd-catalog", "sample-plugin"]);

      expect(warnings.mock.calls).toStrictEqual(
        dependents.length === 0
          ? []
          : [
              [
                `copilot: updating native ref 'native-plugin@aidd-catalog' affects ${PROJECT_ROOT}, /B; projects must refresh their local integrations afterward.`,
              ],
              [
                `cursor: updating user-scope 'sample-plugin' affects ${PROJECT_ROOT}, /B; each project must refresh its own integration afterward.`,
              ],
            ]
      );
      expect(activator.updatedPlugins).toStrictEqual(["native-plugin@aidd-catalog"]);
      const after = deps.userManifestRepo.getCurrent();
      expect(after?.getNativeRegistrations("copilot")?.pluginClaims).toStrictEqual([
        { ref: "native-plugin@aidd-catalog", dependents },
      ]);
      expect(
        after?.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin")?.dependents
      ).toStrictEqual(dependents);
      expect(
        after?.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin")?.version
      ).toBe("1.0.0");
    }
  );

  it("updates only the selected user plugin and exact native ref, preserving unrelated claims and project records", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const native = machine.getNativeRegistrations("copilot");
    if (native === undefined) throw new Error("fixture missing native registrations");
    const otherRef = "native-plugin@other-catalog";
    machine.setNativeRegistrations("copilot", {
      ...native,
      pluginClaims: [...(native.pluginClaims ?? []), { ref: otherRef, dependents: ["/B"] }],
    });
    const unselected = InstalledPlugin.fromMetadata(
      "unselected-plugin",
      "0.0.1",
      { kind: "local", path: "/unselected/source" },
      false,
      "user"
    ).withDependents([PROJECT_ROOT, "/B"]);
    const projectOnly = InstalledPlugin.fromMetadata(
      "project-only",
      "0.0.1",
      { kind: "local", path: "/project/source" },
      false,
      "project"
    );
    machine.addPlugin("cursor", unselected);
    machine.addPlugin("cursor", projectOnly);
    const owned = machine.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin");
    if (owned === undefined) throw new Error("fixture missing user plugin");
    machine.updatePlugin("cursor", owned.withDependents([PROJECT_ROOT, "/B"]));
    const claimsBefore = machine.getNativeRegistrations("copilot")?.pluginClaims;
    deps.fs.setFile(BUILT_SKILL, "# Selected update");
    const otherPath = join(USER_PLUGINS_DIR, "unselected-plugin/skills/demo/SKILL.md");
    deps.fs.setFile(otherPath, "unselected user bytes");

    expect(
      await makeUpdateUseCase(deps, registry, nativeHost).execute({
        pluginNames: ["native-plugin@aidd-catalog", "sample-plugin"],
        toolIds: ["copilot", "cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["native-plugin@aidd-catalog", "sample-plugin"]);

    expect(activator.updatedPlugins).toEqual(["native-plugin@aidd-catalog"]);
    const after = deps.userManifestRepo.getCurrent();
    expect(after?.getNativeRegistrations("copilot")?.pluginClaims).toEqual(claimsBefore);
    expect(
      after?.getPlugins("cursor").find((plugin) => plugin.name === "unselected-plugin")
    ).toEqual(unselected);
    expect(after?.getPlugins("cursor").find((plugin) => plugin.name === "project-only")).toEqual(
      projectOnly
    );
    expect(
      after?.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin")?.dependents
    ).toEqual([PROJECT_ROOT, "/B"]);
    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Selected update"
    );
    expect(deps.fs.getFile(otherPath)).toBe("unselected user bytes");
  });

  it("refuses one ambiguous native name among several selected plugins before any file or host update", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const native = machine.getNativeRegistrations("copilot");
    if (native === undefined) throw new Error("fixture missing native registrations");
    machine.setNativeRegistrations("copilot", {
      ...native,
      pluginClaims: [
        ...(native.pluginClaims ?? []),
        {
          ref: "native-plugin@other-catalog",
          dependents: ["/B"],
        },
      ],
    });
    const before = machine.toJSON();
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    const bytes = deps.fs.getFile(path);
    const savesBefore = deps.userManifestRepo.saveCount;
    deps.fs.setFile(BUILT_SKILL, "# Must not be delivered");

    await expect(
      makeUpdateUseCase(deps, registry, nativeHost).execute({
        pluginNames: ["sample-plugin", "native-plugin"],
        toolIds: ["cursor", "copilot"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/Multiple native catalogues.*exact/);

    expect(activator.updatedPlugins).toEqual([]);
    expect(deps.fs.getFile(path)).toBe(bytes);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.toJSON()).toEqual(before);
  });

  it("excludes built Cursor hooks from the updated user plugin and leaves both projects' hooks unchanged", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    deps.fs.setFile(BUILT_SKILL, "# Updated skill");
    const builtHooks = JSON.stringify({ hooks: { preToolUse: [{ command: "node pre.js" }] } });
    deps.fs.setFile("/built/cursor/plugins/sample-plugin/hooks/hooks.json", builtHooks);
    deps.fs.setFile("/built/cursor/plugins/sample-plugin/hooks/pre.js", "built hook script");
    const hookConfig = (timeout: number) =>
      JSON.stringify({
        version: 1,
        hooks: { preToolUse: [{ command: "node ./.cursor/hooks/sample-plugin/pre.js", timeout }] },
      });
    const projectFiles = new Map([
      [join(PROJECT_ROOT, ".cursor/hooks.json"), hookConfig(10)],
      [join(PROJECT_ROOT, ".cursor/hooks/sample-plugin/pre.js"), "A's adapted script"],
      ["/B/.cursor/hooks.json", hookConfig(20)],
      ["/B/.cursor/hooks/sample-plugin/pre.js", "B's adapted script"],
    ]);
    for (const [path, content] of projectFiles) deps.fs.setFile(path, content);

    expect(
      await makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);

    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Updated skill"
    );
    expect(
      deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/hooks/hooks.json"))
    ).toBeUndefined();
    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/hooks/pre.js"))).toBeUndefined();
    expect(
      [...(deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0]?.files.keys() ?? [])].some(
        (path) => path.startsWith("sample-plugin/hooks/")
      )
    ).toBe(false);
    for (const [path, content] of projectFiles) expect(deps.fs.getFile(path)).toBe(content);
  });

  it("uses the plugin's named marketplace build rather than the first registered catalogue", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "unrelated-first",
        source: { kind: "local", path: "/unrelated" },
        scope: "project",
        addedAt: "2026-05-01T00:00:00.000Z",
      })
    );
    for (const marketplace of await (await makeRegistry()).list(PROJECT_ROOT))
      await registry.save(PROJECT_ROOT, marketplace);
    await installStalePlugin(deps, registry);
    deps.fs.setFile("/built/right/plugins/sample-plugin/skills/demo/SKILL.md", "# Right catalogue");
    deps.fs.setFile("/built/wrong/plugins/sample-plugin/skills/demo/SKILL.md", "# Wrong catalogue");
    const ensureBuilt: EnsureBuiltMarketplace = {
      execute: async ({ marketplace }) => ({
        builtDir: marketplace.name === "aidd-framework" ? "/built/right" : "/built/wrong",
        version: "test",
        rebuilt: true,
      }),
    };

    expect(
      await makeUpdateUseCase(deps, registry, undefined, ensureBuilt).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).toEqual(["sample-plugin"]);

    expect(deps.fs.getFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"))).toBe(
      "# Right catalogue"
    );
    expect(deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0]?.marketplace).toBe(
      "aidd-framework"
    );
  });

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

  it("refuses to overwrite a user-edited Cursor plugin file and retains its installed digest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const path = join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md");
    const before = deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0];
    if (before === undefined) throw new Error("fixture missing plugin claim");
    deps.fs.setFile(path, "# User edited skill\n");
    const savesBefore = deps.userManifestRepo.saveCount;
    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/edited.*SKILL.md|SKILL.md.*edited/);
    expect(deps.fs.getFile(path)).toBe("# User edited skill\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0].files).toEqual(before.files);
  });

  it("refuses a new built file that the user created after v1 without changing bytes or claims", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    const destination = join(USER_PLUGINS_DIR, newRelativePath);
    const machineBefore = deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0];
    if (machineBefore === undefined) throw new Error("fixture missing plugin claim");
    const savesBefore = deps.userManifestRepo.saveCount;
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    deps.fs.setFile(destination, "# User-created\n");

    await expect(
      makeUpdateUseCase(deps, registry).execute({
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/new.md.*untracked|untracked.*new.md/);

    expect(deps.fs.getFile(destination)).toBe("# User-created\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(deps.userManifestRepo.getCurrent()?.getPlugins("cursor")[0]).toEqual(machineBefore);
  });

  it("preflights a Cursor user-file collision before any selected native host update", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    const destination = join(USER_PLUGINS_DIR, newRelativePath);
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    deps.fs.setFile(destination, "# User-created\n");
    const claimBefore = machine.getNativeRegistrations("copilot")?.pluginClaims;
    const savesBefore = deps.userManifestRepo.saveCount;

    await expect(
      makeUpdateUseCase(deps, registry, nativeHost).execute({
        toolIds: ["copilot", "cursor"],
        projectRoot: PROJECT_ROOT,
        scope: "user",
      })
    ).rejects.toThrow(/new.md.*untracked|untracked.*new.md/);

    expect(activator.updatedPlugins).toEqual([]);
    expect(deps.fs.getFile(destination)).toBe("# User-created\n");
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(machine.getNativeRegistrations("copilot")?.pluginClaims).toEqual(claimBefore);
  });

  it("refuses a tracked old path redirected outside the user boundary between plan and apply", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const machine = deps.userManifestRepo.getCurrent();
    const stale = machine?.getPlugins("cursor").find((plugin) => plugin.name === "sample-plugin");
    if (machine === null || stale === undefined) throw new Error("fixture missing plugin");
    const oldRelativePath = "sample-plugin/skills/obsolete/SKILL.md";
    deps.fs.setFile(join(USER_PLUGINS_DIR, oldRelativePath), "old owned bytes");
    machine.updatePlugin(
      "cursor",
      stale.withFiles(
        new Map([...stale.files, [oldRelativePath, deps.hasher.hash("old owned bytes").value]])
      )
    );
    const updater = new UserPluginFileUpdater(
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
    );
    const plan = await updater.planUpdate(
      machine.getPlugins("cursor")[0],
      "cursor",
      PROJECT_ROOT,
      deps.logger
    );
    if (plan === null) throw new Error("fixture did not plan a newer build");
    const foreign = "/foreign/obsolete";
    deps.fs.setSymlink(join(USER_PLUGINS_DIR, "sample-plugin/skills/obsolete"), foreign);
    deps.fs.setFile(join(foreign, "SKILL.md"), "outside user bytes");
    const writeSpy = vi.spyOn(deps.fs, "writeFile");

    await expect(updater.applyUpdate(plan, deps.logger)).rejects.toThrow(/unsafe recorded files/);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(deps.fs.getFile(join(foreign, "SKILL.md"))).toBe("outside user bytes");
    expect(machine.getPlugins("cursor")[0]?.version).toBe("0.0.1");
  });

  it("reports manual reconciliation when user-file I/O fails after an irreversible native update", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "cursor");
    const registry = await makeRegistry();
    await installStalePlugin(deps, registry);
    const { machine, activator, nativeHost } = attachFutureSupportedNativeClaim(deps);
    const newRelativePath = "sample-plugin/skills/demo/new.md";
    const destination = join(USER_PLUGINS_DIR, newRelativePath);
    deps.fs.setFile(join("/built/cursor/plugins", newRelativePath), "# Built v2\n");
    const writeFile = deps.fs.writeFile.bind(deps.fs);
    const writeFailure = new Error("EACCES: injected destination write failure");
    vi.spyOn(deps.fs, "writeFile").mockImplementation(async (path, content) => {
      if (path === destination) throw writeFailure;
      return writeFile(path, content);
    });
    const savesBefore = deps.userManifestRepo.saveCount;

    const operation = makeUpdateUseCase(deps, registry, nativeHost).execute({
      toolIds: ["copilot", "cursor"],
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });
    await expect(operation).rejects.toThrow(
      /native ref may already have been updated.*reconcile manually/
    );
    await expect(operation).rejects.toMatchObject({ cause: writeFailure });

    expect(activator.updatedPlugins).toEqual(["native-plugin@aidd-catalog"]);
    expect(deps.userManifestRepo.saveCount).toBe(savesBefore);
    expect(machine.getPlugins("cursor")[0]?.version).toBe("0.0.1");
    expect(machine.getNativeRegistrations("copilot")?.pluginClaims).toEqual([
      { ref: "native-plugin@aidd-catalog", dependents: [PROJECT_ROOT] },
    ]);
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
