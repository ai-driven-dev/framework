import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostMarketplaceRegistryReader } from "../../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

describe("native plugin ownership follows the host's activation scope", () => {
  const freshNativeSources = (
    toolId: "claude" | "codex",
    activator: FakeNativePluginActivator,
    identities: ReadonlyMap<string, string>
  ) =>
    new Map([
      [
        toolId,
        new FakeNativeMarketplaceSourceReader(
          activator,
          toolId === "claude" ? "registry" : "effective-list",
          (path) => identities.get(path),
          new Map()
        ),
      ],
    ]);
  const readablePlugins = (toolId: "claude" | "codex") =>
    new Map([
      [
        toolId,
        new FakeHostPluginRegistryReader({
          location: `/home/${toolId}/plugins/installed_plugins.json`,
          refs: new Map(),
        }),
      ],
    ]);
  const freshHostCatalogs = () =>
    new Map([
      [
        "claude" as const,
        new FakeHostMarketplaceRegistryReader({
          location: "/home/.claude/plugins/known_marketplaces.json",
          entries: new Map(),
        }),
      ],
    ]);
  const readableHostPlugins = () =>
    new Map([
      [
        "claude" as const,
        new FakeHostPluginRegistryReader({
          location: "/home/.claude/plugins/installed_plugins.json",
          refs: new Map(),
        }),
      ],
    ]);
  it("records a user-scope Claude marketplace without claiming its project-local plugin", async () => {
    const projectRoot = "/project";
    const marketplaceName = "local-catalog";
    const ref = "test-plugin@local-catalog";
    const project = Manifest.create();
    project.addTool("claude", "1.0.0", []);
    project.addPlugin(
      "claude",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        marketplaceName
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: marketplaceName,
        source: { kind: "local", path: "/source" },
        scope: "user",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator({ available: true });
    const fs = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: marketplaceName,
        version: "1.0.0",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      freshHostCatalogs(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      machineRepo,
      freshNativeSources("claude", activator, new Map([["/built/claude", marketplaceName]]))
    );

    const result = await sync.execute({ projectRoot });

    expect(result.activated).toEqual(["claude"]);
    expect(activator.enabledPlugins).toEqual([ref]);
    expect(activator.enabledPluginScopes).toEqual(["project"]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginRefs).toEqual([ref]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("claude")?.marketplaces).toEqual([
      {
        alias: marketplaceName,
        hostName: marketplaceName,
        provenance: { kind: "registry", source: "/built/claude" },
      },
    ]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims ?? []).toEqual(
      []
    );
  });

  it("claims a Claude plugin enabled at user scope without inventing a project dependent", async () => {
    const projectRoot = "/project";
    const alias = "user-catalog";
    const ref = "test-plugin@real-catalog";
    const user = Manifest.create();
    user.addTool("claude", "1.0.0", []);
    user.addPlugin(
      "claude",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "user",
        alias
      )
    );
    const userRepo = new InMemoryManifestRepository(user);
    const projectRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: alias,
        source: { kind: "local", path: "/source" },
        scope: "user",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator({ available: true });
    const fs = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: "real-catalog",
        version: "1.0.0",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["claude", activator]]),
      fakeEnsureBuiltMarketplace(),
      freshHostCatalogs(),
      () => "",
      undefined,
      undefined,
      undefined,
      readablePlugins("claude"),
      userRepo,
      freshNativeSources("claude", activator, new Map([["/built/claude", "real-catalog"]]))
    );

    const result = await sync.execute({ projectRoot, scope: "user", manifestRepo: userRepo });

    expect(result.errors).toEqual([]);
    expect(activator.enabledPlugins).toEqual([ref]);
    expect(activator.enabledPluginScopes).toEqual(["user"]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("claude")?.marketplaces).toEqual([
      {
        alias,
        hostName: "real-catalog",
        provenance: { kind: "registry", source: "/built/claude" },
      },
    ]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toEqual([
      { ref, dependents: [] },
    ]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("claude")).toBeUndefined();
  });

  it("records only the user-scope marketplace in the machine manifest when a project syncs both scopes", async () => {
    const projectRoot = "/project";
    const project = Manifest.create();
    project.addTool("claude", "1.0.0", []);
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    for (const [name, scope] of [
      ["user-alias", "user"],
      ["project-alias", "project"],
    ] as const) {
      await registry.save(
        projectRoot,
        Marketplace.create({
          name,
          source: { kind: "local", path: `/source/${name}` },
          scope,
          addedAt: "2026-09-15T00:00:00Z",
        })
      );
    }
    const fs = new InMemoryFileAdapter({
      "/built/user-alias/.claude-plugin/marketplace.json": JSON.stringify({
        name: "real-user",
        version: "1.0.0",
        plugins: [],
      }),
      "/built/project-alias/.claude-plugin/marketplace.json": JSON.stringify({
        name: "real-project",
        version: "1.0.0",
        plugins: [],
      }),
    });
    const activator = new FakeNativePluginActivator({ available: true, enablesPlugins: false });
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["claude", activator]]),
      {
        execute: async ({ marketplace }) => ({
          builtDir: `/built/${marketplace.name}`,
          version: "1.0.0",
          rebuilt: true,
        }),
      },
      freshHostCatalogs(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      machineRepo,
      freshNativeSources(
        "claude",
        activator,
        new Map([
          ["/built/user-alias", "real-user"],
          ["/built/project-alias", "real-project"],
        ])
      )
    );

    const result = await sync.execute({ projectRoot });

    expect(result.errors).toEqual([]);
    const projectMarketplaces = projectRepo
      .getCurrent()
      ?.getNativeRegistrations("claude")?.marketplaces;
    expect(projectMarketplaces).toHaveLength(2);
    expect(projectMarketplaces).toEqual(
      expect.arrayContaining([
        {
          alias: "user-alias",
          hostName: "real-user",
          provenance: { kind: "registry", source: "/built/user-alias" },
        },
        {
          alias: "project-alias",
          hostName: "real-project",
          provenance: { kind: "registry", source: "/built/project-alias" },
        },
      ])
    );
    expect(machineRepo.getCurrent()?.getNativeRegistrations("claude")?.marketplaces).toEqual([
      {
        alias: "user-alias",
        hostName: "real-user",
        provenance: { kind: "registry", source: "/built/user-alias" },
      },
    ]);
  });

  it("records a Codex plugin as machine-owned even when its marketplace source is project-local", async () => {
    const projectRoot = "/codex-project";
    const marketplaceName = "local-catalog";
    const ref = "test-plugin@real-catalog";
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    project.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        marketplaceName
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: marketplaceName,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator({ available: true });
    const fs = new InMemoryFileAdapter({
      "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
        name: "real-catalog",
        version: "1.0.0",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    fs.setSymlink(projectRoot, "/resolved-codex-project");
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["codex", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readablePlugins("codex"),
      machineRepo,
      freshNativeSources("codex", activator, new Map([["/built/codex", "real-catalog"]]))
    );

    const result = await sync.execute({ projectRoot });

    expect(result.activated).toEqual(["codex"]);
    expect(activator.enabledPlugins).toEqual([ref]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([ref]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref, dependents: ["/resolved-codex-project"] },
    ]);

    await sync.execute({ projectRoot });
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref, dependents: ["/resolved-codex-project"] },
    ]);
  });

  it("preserves another machine-owned marketplace claim during a narrowed sync", async () => {
    const projectRoot = "/codex-project";
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    for (const alias of ["market-a", "market-b"]) {
      project.addPlugin(
        "codex",
        InstalledPlugin.fromMetadata(
          `plugin-${alias.at(-1)}`,
          "1.0.0",
          { kind: "local", path: `/source/${alias}` },
          true,
          "project",
          alias
        )
      );
    }
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    for (const alias of ["market-a", "market-b"]) {
      await registry.save(
        projectRoot,
        Marketplace.create({
          name: alias,
          source: { kind: "local", path: `/source/${alias}` },
          scope: "project",
          addedAt: "2026-09-15T00:00:00Z",
        })
      );
    }
    const fs = new InMemoryFileAdapter({
      "/built/market-a/.agents/plugins/marketplace.json": JSON.stringify({
        name: "real-a",
        version: "1.0.0",
        plugins: [{ name: "plugin-a" }],
      }),
      "/built/market-b/.agents/plugins/marketplace.json": JSON.stringify({
        name: "real-b",
        version: "1.0.0",
        plugins: [{ name: "plugin-b" }],
      }),
    });
    const activator = new FakeNativePluginActivator({ available: true });
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["codex", activator]]),
      {
        execute: async ({ marketplace }) => ({
          builtDir: `/built/${marketplace.name}`,
          version: "1.0.0",
          rebuilt: true,
        }),
      },
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readablePlugins("codex"),
      machineRepo,
      freshNativeSources(
        "codex",
        activator,
        new Map([
          ["/built/market-a", "real-a"],
          ["/built/market-b", "real-b"],
        ])
      )
    );

    await sync.execute({ projectRoot, marketplaceNames: ["market-b"] });
    await sync.execute({ projectRoot, marketplaceNames: ["market-a"] });

    expect(activator.enabledPlugins).toEqual(["plugin-b@real-b", "plugin-a@real-a"]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([
      "plugin-b@real-b",
      "plugin-a@real-a",
    ]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: "plugin-b@real-b", dependents: [projectRoot] },
      { ref: "plugin-a@real-a", dependents: [projectRoot] },
    ]);
  });

  it.each([
    { name: "binary unavailable", available: false, failOnPlugins: [] },
    { name: "host enable refused", available: true, failOnPlugins: ["test-plugin@real-catalog"] },
  ])("does not add a project dependency after $name", async (failure) => {
    const projectRoot = "/B";
    const alias = "local-catalog";
    const ref = "test-plugin@real-catalog";
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    project.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        alias
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias, hostName: "real-catalog" }],
      pluginRefs: [],
      pluginClaims: [{ ref, dependents: ["/A"] }],
    });
    const machineRepo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: alias,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator(failure);
    const fs = new InMemoryFileAdapter({
      "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
        name: "real-catalog",
        version: "1.0.0",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["codex", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readablePlugins("codex"),
      machineRepo,
      freshNativeSources("codex", activator, new Map([["/built/codex", "real-catalog"]]))
    );

    const result = await sync.execute({ projectRoot });

    expect(result.errors).toEqual([]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs ?? []).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref, dependents: ["/A"] },
    ]);
    if (failure.available) {
      expect(result.warnings).toEqual([expect.stringContaining("enable plugin")]);
      expect(activator.enabledPlugins).toEqual([]);
    } else {
      expect(result.binaryMissing).toEqual([{ toolId: "codex", binary: "codex" }]);
      expect(activator.addedMarketplaces).toEqual([]);
    }
  });

  it("does not enable or claim a global ref when the host plugin registry cannot be read", async () => {
    const projectRoot = "/B";
    const alias = "local-catalog";
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    project.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        alias
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: alias,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator({ available: true });
    const fs = new InMemoryFileAdapter({
      "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
        name: "real-catalog",
        version: "1.0.0",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    const hostReader: HostPluginRegistryReader = {
      read: async () => {
        throw new Error("host plugin registry unreadable");
      },
    };
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["codex", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      new Map([["codex", hostReader]]),
      machineRepo
    );

    const result = await sync.execute({ projectRoot });

    expect(result.errors).toEqual([{ scope: "codex", message: "host plugin registry unreadable" }]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs ?? []).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims ?? []).toEqual(
      []
    );
  });

  it("does not attach to a foreign enabled host ref just because another catalog has the same plugin name", async () => {
    const projectRoot = "/B";
    const alias = "local-catalog";
    const requestedRef = "test-plugin@real-catalog";
    const otherRef = "test-plugin@other-catalog";
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    project.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        alias
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [{ alias: "other", hostName: "other-catalog" }],
      pluginRefs: [],
      pluginClaims: [{ ref: otherRef, dependents: ["/A"] }],
    });
    const machineRepo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: alias,
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const activator = new FakeNativePluginActivator({ available: true });
    const fs = new InMemoryFileAdapter({
      "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
        name: "real-catalog",
        version: "1.0.0",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    const hostReader: HostPluginRegistryReader = {
      read: async () => ({
        location: "/host/registry",
        refs: new Map([[requestedRef, { enabled: true }]]),
      }),
    };
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["codex", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      new Map([["codex", hostReader]]),
      machineRepo
    );

    const result = await sync.execute({ projectRoot });

    expect(result.errors).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: otherRef, dependents: ["/A"] },
    ]);
  });
});
