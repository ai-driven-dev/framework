import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { NativeMarketplaceSourceReader } from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

describe("native catalogue source provenance", () => {
  it("keeps foreign cache bytes and records no claim or enablement when post-add Codex source differs", async () => {
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
                    root: "/foreign",
                    sourceType: "local",
                    source: "/foreign",
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
    const result = await sync.execute({ projectRoot: "/A" });
    expect(result.warnings.join(" ")).toMatch(
      /post-add|add returned.*effective host source.*reconcile manually/i
    );
    expect(activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations("codex")).toBeUndefined();
    expect(await fs.readFile("/foreign/cache/marker.json")).toBe("foreign bytes");
  });
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
