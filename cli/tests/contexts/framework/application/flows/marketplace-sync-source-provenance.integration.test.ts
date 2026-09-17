import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { HostMarketplaceRegistryReading } from "../../../../../src/contexts/tools/domain/ports/host-marketplace-registry-reader.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type { NativeMarketplaceSourceReader } from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
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

describe("native catalogue source provenance", () => {
  async function hostPluginProofFixture(
    reading?: HostPluginRegistryReading,
    options: {
      toolId?: "claude" | "codex";
      catalogue?: HostMarketplaceRegistryReading;
      marketplaceScope?: "project" | "user";
      plugin?: boolean;
    } = {}
  ) {
    const toolId = options.toolId ?? "codex";
    const builtDir = `/built/${toolId}`;
    const project = Manifest.create();
    project.addTool(toolId, "1.0.0", []);
    if (options.plugin !== false)
      project.addPlugin(
        toolId,
        InstalledPlugin.fromMetadata(
          "test-plugin",
          "1.0.0",
          { kind: "local", path: "/source" },
          true,
          "project",
          "alias"
        )
      );
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      "/A",
      Marketplace.create({
        name: "alias",
        source: { kind: "local", path: "/source" },
        scope: options.marketplaceScope ?? "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const fs = new InMemoryFileAdapter({
      [`${builtDir}/${toolId === "codex" ? ".agents/plugins" : ".claude-plugin"}/marketplace.json`]:
        JSON.stringify({
          name: "same-name",
          plugins: [{ name: "test-plugin" }],
        }),
    });
    fs.setFile("/foreign/cache/marker.json", "foreign bytes");
    const activator = new FakeNativePluginActivator({ available: true });
    const sync = new MarketplaceSyncSettingsUseCase(
      fs,
      projectRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([[toolId, activator]]),
      fakeEnsureBuiltMarketplace(),
      options.catalogue === undefined
        ? new Map()
        : new Map([[toolId, new FakeHostMarketplaceRegistryReader(options.catalogue)]]),
      () => "",
      undefined,
      undefined,
      undefined,
      reading === undefined
        ? new Map()
        : new Map([[toolId, new FakeHostPluginRegistryReader(reading)]]),
      machineRepo,
      new Map([
        [
          toolId,
          new FakeNativeMarketplaceSourceReader(
            activator,
            toolId === "codex" ? "effective-list" : "registry",
            (path) => (path === builtDir ? "same-name" : undefined),
            new Map()
          ),
        ],
      ])
    );
    return { sync, fs, activator, projectRepo, machineRepo };
  }

  it.each(["project", "user"] as const)(
    "refuses a %s-scope Claude catalogue if its registry becomes unreadable after the source check",
    async (marketplaceScope) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        {
          toolId: "claude",
          marketplaceScope,
          catalogue: { location: "/host/catalogues.json", unreadable: "permission denied" },
        }
      );
      const result = await f.sync.execute({ projectRoot: "/A" });
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toMatch(/same-name.*host registry is unreadable/);
      expect(f.activator.addedMarketplaces).toEqual([]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations("claude")).toBeUndefined();
      expect(f.projectRepo.getCurrent()?.getNativeRegistrations("claude")?.marketplaces).toEqual(
        []
      );
      expect(f.machineRepo.saveCount).toBe(0);
      expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
    }
  );

  it.each(["project", "user"] as const)(
    "refuses a newly appearing %s-scope Claude catalogue without a canonical claim even with identical plugin names",
    async (marketplaceScope) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        {
          toolId: "claude",
          marketplaceScope,
          catalogue: {
            location: "/host/catalogues.json",
            entries: new Map([["same-name", "/foreign/claude"]]),
          },
        }
      );
      const foreignCatalog = JSON.stringify({
        name: "same-name",
        plugins: [{ name: "test-plugin" }],
      });
      f.fs.setFile("/foreign/claude/.claude-plugin/marketplace.json", foreignCatalog);
      const result = await f.sync.execute({ projectRoot: "/A" });
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toContain("without a canonical AIDD claim");
      expect(f.projectRepo.getCurrent()?.getNativeRegistrations("claude")).toMatchObject({
        marketplaces: [],
        pluginRefs: [],
      });
      expect(f.activator.addedMarketplaces).toEqual([]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations("claude")).toBeUndefined();
      expect(f.machineRepo.saveCount).toBe(0);
      expect(f.fs.getFile("/foreign/claude/.claude-plugin/marketplace.json")).toBe(foreignCatalog);
    }
  );

  it.each([
    {
      toolId: "claude",
      marketplaceScope: "user",
      machineCatalogue: true,
      otherHost: "other-catalog",
    },
    {
      toolId: "claude",
      marketplaceScope: "project",
      machineCatalogue: false,
      otherHost: "other-catalog",
    },
    {
      toolId: "codex",
      marketplaceScope: "user",
      machineCatalogue: true,
      otherHost: "other-catalog",
    },
    {
      toolId: "codex",
      marketplaceScope: "project",
      machineCatalogue: true,
      otherHost: "other-catalog",
    },
    { toolId: "claude", marketplaceScope: "user", machineCatalogue: true, otherHost: "same-name" },
    {
      toolId: "codex",
      marketplaceScope: "project",
      machineCatalogue: true,
      otherHost: "same-name",
    },
  ] as const)(
    "owns only the catalogue, not undeclared plugins, and is idempotent for $toolId / $marketplaceScope / $otherHost",
    async ({ toolId, marketplaceScope, machineCatalogue, otherHost }) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        { toolId, marketplaceScope, plugin: false }
      );
      const machine = f.machineRepo.getCurrent();
      if (machine === null) throw new Error("fixture lacks machine manifest");
      const target = {
        alias: "alias",
        hostName: "same-name",
        provenance:
          toolId === "claude"
            ? { kind: "registry" as const, source: "/built/claude" }
            : {
                kind: "effective-list" as const,
                root: "/built/codex",
                sourceType: "local",
                source: "/built/codex",
              },
      };
      const other = {
        alias: "other-alias",
        hostName: otherHost,
        provenance:
          otherHost === target.hostName
            ? target.provenance
            : toolId === "claude"
              ? { kind: "registry" as const, source: "/other/source" }
              : {
                  kind: "effective-list" as const,
                  root: "/other/source",
                  sourceType: "local",
                  source: "/other/source",
                },
      };
      const otherRef = `other-plugin@${otherHost}`;
      machine.addTool(toolId, "0.9.0", []);
      machine.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [other],
        pluginRefs: [otherRef],
        pluginClaims: [{ ref: otherRef, dependents: ["/B"] }],
      });

      for (let run = 0; run < 2; run += 1) {
        const result = await f.sync.execute({ projectRoot: "/A" });
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(f.projectRepo.getCurrent()?.getNativeRegistrations(toolId)).toEqual({
          binary: toolId,
          marketplaces: [target],
          pluginRefs: [],
        });
        expect(f.machineRepo.getCurrent()?.getNativeRegistrations(toolId)).toEqual({
          binary: toolId,
          marketplaces: machineCatalogue ? [other, target] : [other],
          pluginRefs: [otherRef],
          pluginClaims: [{ ref: otherRef, dependents: ["/B"] }],
        });
        expect(f.machineRepo.saveCount).toBe(machineCatalogue ? 1 : 0);
        expect(f.machineRepo.getCurrent()?.getToolVersion(toolId)).toBe("0.9.0");
      }
      expect(f.activator.addedMarketplaces).toEqual([`/built/${toolId}`]);
      expect(f.activator.enabledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.activator.upgradeCount).toBe(1);
      expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
    }
  );

  it.each(["claude", "codex"] as const)(
    "initializes a fresh %s machine tool record for a catalogue without claiming its available plugins",
    async (toolId) => {
      const f = await hostPluginProofFixture(
        { location: "/host/plugins.json", refs: new Map() },
        { toolId, marketplaceScope: "user", plugin: false }
      );
      const result = await f.sync.execute({ projectRoot: "/A" });
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(f.machineRepo.getCurrent()?.hasTool(toolId)).toBe(true);
      expect(f.machineRepo.getCurrent()?.getToolVersion(toolId)).toBe("1.0.0");
      expect(f.machineRepo.getCurrent()?.getNativeRegistrations(toolId)).toMatchObject({
        binary: toolId,
        marketplaces: [{ alias: "alias", hostName: "same-name" }],
        pluginRefs: [],
        pluginClaims: [],
      });
      expect(f.machineRepo.saveCount).toBe(1);
      expect(f.activator.enabledPlugins).toEqual([]);
    }
  );

  it("allows fresh Claude registration when the catalogue registry is explicitly absent", async () => {
    const f = await hostPluginProofFixture(
      { location: "/host/plugins.json", absent: true },
      { toolId: "claude", catalogue: { location: "/host/catalogues.json", absent: true } }
    );
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual(["/built/claude"]);
    expect(f.activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations("claude")?.marketplaces).toEqual([
      {
        alias: "alias",
        hostName: "same-name",
        provenance: { kind: "registry", source: "/built/claude" },
      },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("claude")).toBeUndefined();
  });

  it.each([
    { label: "missing registry reader", reading: undefined, reason: "undefined" },
    {
      label: "unreadable registry with a diagnostic",
      reading: { location: "/host/plugins.json", unreadable: "permission denied" },
      reason: "permission denied",
    },
    {
      label: "unreadable registry without a diagnostic",
      reading: { location: "/host/plugins.json" },
      reason: "/host/plugins.json",
    },
  ])("refuses fresh Codex activation with $label", async ({ reading, reason }) => {
    const f = await hostPluginProofFixture(reading);
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.warnings.join(" ")).toContain("unreadable host plugin registry");
    expect(result.warnings.join(" ")).toContain(reason);
    expect(f.activator.addedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(f.activator.removedMarketplaces).toEqual([]);
    expect(f.activator.upgradeCount).toBe(0);
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations("codex")).toMatchObject({
      marketplaces: [],
      pluginRefs: [],
    });
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")).toBeUndefined();
    expect(f.machineRepo.saveCount).toBe(0);
    expect(f.fs.getFile("/foreign/cache/marker.json")).toBe("foreign bytes");
  });

  it("accepts an explicitly absent host plugin registry only after proving the newly added source", async () => {
    const f = await hostPluginProofFixture({ location: "/host/plugins.json", absent: true });
    const result = await f.sync.execute({ projectRoot: "/A" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(f.activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: "test-plugin@same-name", dependents: ["/A"] },
    ]);
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces).toEqual([
      {
        alias: "alias",
        hostName: "same-name",
        provenance: {
          kind: "effective-list",
          root: "/built/codex",
          sourceType: "local",
          source: "/built/codex",
        },
      },
    ]);
  });

  it.each([
    "foreign source",
    "foreign root",
    "non-local source type",
    "unreadable",
    "missing catalogue",
    "unproven catalogue",
  ] as const)(
    "keeps foreign bytes and records no claim or enablement when post-add Codex proof is %s",
    async (proof) => {
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
          "alias"
        )
      );
      const projectRepo = new InMemoryManifestRepository(project);
      const machineRepo = new InMemoryManifestRepository(Manifest.create());
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/A",
        Marketplace.create({
          name: "alias",
          source: { kind: "local", path: "/source" },
          scope: "project",
          addedAt: "2026-09-15T00:00:00Z",
        })
      );
      const fs = new InMemoryFileAdapter({
        "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
          name: "same-name",
          plugins: [{ name: "test-plugin" }],
        }),
      });
      fs.setFile("/foreign/cache/marker.json", "foreign bytes");
      const activator = new FakeNativePluginActivator({ available: true });
      const source: NativeMarketplaceSourceReader = {
        read: async () => {
          if (activator.addedMarketplaces.length === 0)
            return { location: "host", entries: new Map() };
          if (proof === "unreadable")
            return { location: "host", unreadable: "malformed source listing" };
          if (proof === "missing catalogue") return { location: "host", entries: new Map() };
          return {
            location: "host",
            entries: new Map([
              [
                "same-name",
                proof === "unproven catalogue"
                  ? null
                  : {
                      kind: "effective-list",
                      root:
                        proof === "foreign root" || proof === "foreign source"
                          ? "/foreign"
                          : "/built/codex",
                      sourceType: proof === "non-local source type" ? "github" : "local",
                      source: proof === "foreign source" ? "/foreign" : "/built/codex",
                    },
              ],
            ]),
          };
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
        new Map([
          [
            "codex",
            new FakeHostPluginRegistryReader({ location: "host-plugins", refs: new Map() }),
          ],
        ]),
        machineRepo,
        new Map([["codex", source]])
      );
      const result = await sync.execute({ projectRoot: "/A" });
      expect(result.warnings.join(" ")).toMatch(
        /post-add|add returned.*effective host source.*reconcile manually/i
      );
      expect(activator.addedMarketplaces).toEqual(["/built/codex"]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")).toBeUndefined();
      expect(
        projectRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces ?? []
      ).toStrictEqual([]);
      expect(
        projectRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginRefs ?? []
      ).toStrictEqual([]);
      expect(activator.removedMarketplaces).toStrictEqual([]);
      expect(activator.upgradeCount).toBe(0);
      expect(await fs.readFile("/foreign/cache/marker.json")).toBe("foreign bytes");
    }
  );
  it.each([
    {
      label: "unreadable CLI source",
      reading: {
        location: "copilot plugin marketplace list --json",
        unreadable:
          "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry",
      },
      reason: "Copilot CLI marketplace list --json unavailable",
    },
    {
      label: "foreign effective source",
      reading: {
        location: "copilot effective marketplace list",
        entries: new Map([
          [
            "same-name",
            {
              kind: "effective-list" as const,
              root: "/foreign",
              sourceType: "local",
              source: "/foreign",
            },
          ],
        ]),
      },
      reason: "host source unproven",
    },
  ])(
    "refuses Copilot activation with $label without changing declarative settings",
    async ({ reading, reason }) => {
      const projectRoot = "/A";
      const project = Manifest.create();
      project.addTool("copilot", "1.0.0", []);
      project.addPlugin(
        "copilot",
        InstalledPlugin.fromMetadata(
          "test-plugin",
          "1.0.0",
          { kind: "local", path: "/source" },
          true,
          "project",
          "alias"
        )
      );
      const projectRepo = new InMemoryManifestRepository(project);
      const machineRepo = new InMemoryManifestRepository(Manifest.create());
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        projectRoot,
        Marketplace.create({
          name: "alias",
          source: { kind: "local", path: "/source" },
          scope: "project",
          addedAt: "2026-09-15T00:00:00Z",
        })
      );
      const fs = new InMemoryFileAdapter({
        "/built/copilot/.plugin/marketplace.json": JSON.stringify({
          name: "same-name",
          plugins: [{ name: "test-plugin" }],
        }),
      });
      const settingsPath = `${projectRoot}/.github/copilot/settings.json`;
      const foreignSettings = JSON.stringify({
        enabledPlugins: { "foreign@foreign-catalog": true },
        extraKnownMarketplaces: { "foreign-catalog": { source: "github" } },
      });
      fs.setFile(settingsPath, foreignSettings);
      const activator = new FakeNativePluginActivator({ available: true });
      const source: NativeMarketplaceSourceReader = {
        read: async () => reading,
      };
      const sync = new MarketplaceSyncSettingsUseCase(
        fs,
        projectRepo,
        registry,
        new DeterministicHasher(),
        new CapturingLogger(),
        new Map([["copilot", activator]]),
        fakeEnsureBuiltMarketplace(),
        new Map(),
        () => "",
        undefined,
        undefined,
        undefined,
        new Map([
          [
            "copilot",
            new FakeHostPluginRegistryReader({ location: "host-plugins", refs: new Map() }),
          ],
        ]),
        machineRepo,
        new Map([["copilot", source]])
      );
      const result = await sync.execute({ projectRoot });
      expect(result.warnings.join(" ")).toContain(reason);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(activator.upgradeCount).toBe(0);
      expect(machineRepo.getCurrent()?.getNativeRegistrations("copilot")).toBeUndefined();
      expect(await fs.readFile(settingsPath)).toBe(foreignSettings);
    }
  );
  it("claims a fresh Codex source after post-read and attaches B without replacing it", async () => {
    const projectRoot = "/A";
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
        "alias"
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machineRepo = new InMemoryManifestRepository(Manifest.create());
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "alias",
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const fs = new InMemoryFileAdapter({
      "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
        name: "same-name",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    const activator = new FakeNativePluginActivator({ available: true });
    const source: NativeMarketplaceSourceReader = {
      read: async () => ({
        location: "host",
        entries:
          activator.addedMarketplaces.length === 0
            ? new Map()
            : new Map([
                [
                  "same-name",
                  {
                    kind: "effective-list",
                    root: "/built/codex",
                    sourceType: "local",
                    source: "/built/codex",
                  },
                ],
              ]),
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
      new Map([
        ["codex", new FakeHostPluginRegistryReader({ location: "host-plugins", refs: new Map() })],
      ]),
      machineRepo,
      new Map([["codex", source]])
    );
    const result = await sync.execute({ projectRoot });
    expect(result.errors).toEqual([]);
    expect(activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(activator.enabledPlugins).toEqual(["test-plugin@same-name"]);
    expect(
      machineRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces[0].provenance
    ).toEqual({
      kind: "effective-list",
      root: "/built/codex",
      sourceType: "local",
      source: "/built/codex",
    });
    const projectB = Manifest.create();
    projectB.addTool("codex", "1.0.0", []);
    projectB.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata(
        "test-plugin",
        "1.0.0",
        { kind: "local", path: "/source" },
        true,
        "project",
        "alias"
      )
    );
    const registryB = new InMemoryMarketplaceRegistry();
    await registryB.save(
      "/B",
      Marketplace.create({
        name: "alias",
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const syncB = new MarketplaceSyncSettingsUseCase(
      fs,
      new InMemoryManifestRepository(projectB),
      registryB,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["codex", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      new Map([
        [
          "codex",
          new FakeHostPluginRegistryReader({
            location: "host-plugins",
            refs: new Map([["test-plugin@same-name", { enabled: true }]]),
          }),
        ],
      ]),
      machineRepo,
      new Map([["codex", source]])
    );
    await syncB.execute({ projectRoot: "/B" });
    expect(activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: "test-plugin@same-name", dependents: ["/A", "/B"] },
    ]);
  });
  it("does not add, upgrade, or enable a foreign same-name Codex catalogue with a stale AIDD claim and empty host refs", async () => {
    const projectRoot = "/A";
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
        "alias"
      )
    );
    const projectRepo = new InMemoryManifestRepository(project);
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [
        {
          alias: "alias",
          hostName: "same-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: [],
      pluginClaims: [],
    });
    const machineRepo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "alias",
        source: { kind: "local", path: "/source" },
        scope: "project",
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
    const fs = new InMemoryFileAdapter({
      "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
        name: "same-name",
        plugins: [{ name: "test-plugin" }],
      }),
    });
    fs.setFile("/foreign/marker.json", "foreign bytes");
    const activator = new FakeNativePluginActivator({ available: true });
    const source: NativeMarketplaceSourceReader = {
      read: async () => ({
        location: "host",
        entries: new Map([
          [
            "same-name",
            { kind: "effective-list", root: "/foreign", sourceType: "local", source: "/foreign" },
          ],
        ]),
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
      new Map([
        ["codex", new FakeHostPluginRegistryReader({ location: "host-plugins", refs: new Map() })],
      ]),
      machineRepo,
      new Map([["codex", source]])
    );
    const result = await sync.execute({ projectRoot });
    expect(result.warnings.join(" ")).toMatch(/same-name.*source.*reconcile manually/i);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(activator.upgradeCount).toBe(0);
    expect(await fs.readFile("/foreign/marker.json")).toBe("foreign bytes");
    expect(
      machineRepo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces[0].provenance?.source
    ).toBe("/old");
  });
});
