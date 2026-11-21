import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FakeHostMarketplaceSources } from "../../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { registeredHostInspector } from "../../shared/testing/registered-host-inspector.builder.js";
import { registeredTools } from "../../shared/testing/registered-tools.builder.js";
import { buildCheckRegistration } from "../testing/build-check-registration.builder.js";
import {
  buildSync,
  claude,
  marketplace,
  nativeSource,
  PROJECT_ROOT,
  readableHostPlugins,
} from "../testing/marketplace-sync-native-activation.builder.js";

describe("native activation: recorded refs", () => {
  describe("what doctor tells a person to run becomes true once sync has run", () => {
    /** Answers `read()` from the activator's own recorded state, so a registry reading
     * always reflects exactly what the last `execute()` asked the host CLI to enable. */
    class RegistryBoundToActivator implements HostPluginRegistry {
      constructor(private readonly activator: FakeHostActions) {}

      async read(): Promise<HostPluginRegistryReading> {
        return {
          location: "/home/dev/.claude/plugins/installed_plugins.json",
          refs: new Map(this.activator.enabledPlugins.map((ref) => [ref, { enabled: true }])),
        };
      }
    }

    it("goes from `aidd sync` to healthy after sync re-registers", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo, fs } = buildSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());
      const doctorRegistration = buildCheckRegistration(
        fs,
        registry,
        (binary) => binary === claude && activator.isAvailable(),
        registeredHostInspector(
          fs,
          new Map([[claude, new RegistryBoundToActivator(activator)]]),
          new Map()
        ),
        () => "/user-cache",
        { get: () => "1.0.0" },
        registeredTools()
      );
      // `SyncSettings.execute` mutates the loaded manifest in place, so one
      // load kept across both doctor calls sees the sync that runs in between.
      const manifest = await manifestRepo.load();
      expect(manifest, "buildSync always seeds a manifest").not.toBeNull();
      if (manifest === null) throw new Error("unreachable — asserted above");

      const before = await doctorRegistration.execute({
        manifest,
        projectRoot: PROJECT_ROOT,
        allowedIds: null,
      });
      expect(
        before.some((issue) => issue.severity === "error" && issue.fix.includes("aidd sync"))
      ).toBe(true);

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      const after = await doctorRegistration.execute({
        manifest,
        projectRoot: PROJECT_ROOT,
        allowedIds: null,
      });
      expect(after.filter((issue) => issue.severity === "error")).toEqual([]);
    });
  });

  // `recordNativeRegistrations`'s keyed merge applies only to a narrowed run: an unnarrowed one
  // replaces the whole entry, or a ref the registry no longer carries is retained forever.
  describe("an unnarrowed run replaces the whole recorded entry (lot 9 review C-B1)", () => {
    const LIVE_MARKETPLACE = "market-live";
    const LIVE_PLUGIN = "plugin-live";

    function liveMarketplace(): Marketplace {
      return Marketplace.create({
        name: LIVE_MARKETPLACE,
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
        addedAt: "2026-09-02T00:00:00Z",
      });
    }

    function buildLiveSync(activator: FakeHostActions) {
      const registry = new InMemoryMarketplaceRegistry();
      const fs = new InMemoryFileAdapter({
        "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
          name: LIVE_MARKETPLACE,
          version: "1.0.0",
          plugins: [{ name: LIVE_PLUGIN }],
        }),
      });
      const manifest = Manifest.create();
      manifest.addTool(claude, "test", []);
      manifest.addPlugin(
        claude,
        InstalledPlugin.fromMetadata(
          LIVE_PLUGIN,
          "1.0.0",
          { kind: "github", repo: "ai-driven-dev/framework" },
          true,
          "project",
          LIVE_MARKETPLACE
        )
      );
      const manifestRepo = new InMemoryManifestRepository(manifest);
      const useCase = marketplaceSync({
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        hostPluginRegistries: readableHostPlugins(),
        nativeSources: nativeSource(activator, LIVE_MARKETPLACE),
      });
      return { useCase, registry, manifestRepo };
    }

    it("drops a recorded ref whose hostName the registry no longer carries", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo } = buildLiveSync(activator);
      await registry.save(PROJECT_ROOT, liveMarketplace());
      const staleManifest = await manifestRepo.load();
      staleManifest?.setNativeRegistrations(claude, {
        binary: "claude",
        marketplaces: [{ alias: "market-dead", hostName: "host-dead" }],
        pluginRefs: ["plugin-dead@host-dead"],
      });
      if (staleManifest) await manifestRepo.save(staleManifest);

      // Unnarrowed — no `marketplaceNames`, the shape `sync` and `setup` both run.
      await useCase.execute({ projectRoot: PROJECT_ROOT });

      const recorded = (await manifestRepo.load())?.getNativeRegistrations(claude);
      expect(recorded?.pluginRefs).not.toContain("plugin-dead@host-dead");
      expect(recorded?.marketplaces).not.toContainEqual({
        alias: "market-dead",
        hostName: "host-dead",
      });
    });
  });

  // Two of this project's local aliases can resolve to one `hostName`; `retainedMarketplaces`
  // filters by alias, so refs must be retained by alias too, never by hostName alone.
  describe("a narrowed run preserves another alias's refs at a shared hostName (lot 9 review C-B2)", () => {
    const SHARED_HOST_NAME = "shared-catalog";
    const ALIAS_X = "alias-x";
    const ALIAS_Y = "alias-y";
    const PLUGIN_X = "plugin-x";
    const PLUGIN_Y = "plugin-y";

    function ensureBuiltSharedCatalog(): BuiltMarketplaceEnsurer {
      return {
        execute: async () => ({
          builtDir: "/built/by-alias/shared",
          version: "test",
          rebuilt: true,
        }),
      };
    }

    function aliasMarketplace(alias: string): Marketplace {
      return Marketplace.create({
        name: alias,
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
        addedAt: "2026-09-02T00:00:00Z",
      });
    }

    it("keeps the retained alias's own refs after a run narrowed to the other one", async () => {
      const activator = new FakeHostActions({ available: true });
      const registry = new InMemoryMarketplaceRegistry();
      const fs = new InMemoryFileAdapter({
        "/built/by-alias/shared/.claude-plugin/marketplace.json": JSON.stringify({
          name: SHARED_HOST_NAME,
          version: "1.0.0",
          plugins: [{ name: PLUGIN_X }, { name: PLUGIN_Y }],
        }),
      });
      const manifest = Manifest.create();
      manifest.addTool(claude, "test", []);
      manifest.addPlugin(
        claude,
        InstalledPlugin.fromMetadata(
          PLUGIN_X,
          "1.0.0",
          { kind: "github", repo: "ai-driven-dev/framework" },
          true,
          "project",
          ALIAS_X
        )
      );
      manifest.addPlugin(
        claude,
        InstalledPlugin.fromMetadata(
          PLUGIN_Y,
          "1.0.0",
          { kind: "github", repo: "ai-driven-dev/framework" },
          true,
          "project",
          ALIAS_Y
        )
      );
      const manifestRepo = new InMemoryManifestRepository(manifest);
      const useCase = marketplaceSync({
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[claude, activator]]),
        ensureBuilt: ensureBuiltSharedCatalog(),
        hostPluginRegistries: readableHostPlugins(),
        nativeSources: new Map([
          [
            claude,
            new FakeHostMarketplaceSources(
              activator,
              "registry",
              (path) => (path === "/built/by-alias/shared" ? SHARED_HOST_NAME : undefined),
              new Map()
            ),
          ],
        ]),
      });
      await registry.save(PROJECT_ROOT, aliasMarketplace(ALIAS_X));
      await registry.save(PROJECT_ROOT, aliasMarketplace(ALIAS_Y));

      await useCase.execute({ projectRoot: PROJECT_ROOT });
      const beforeNarrow = (await manifestRepo.load())?.getNativeRegistrations(claude);
      expect(beforeNarrow?.pluginRefs, "both refs recorded before the narrowed run").toEqual(
        expect.arrayContaining([
          `${PLUGIN_X}@${SHARED_HOST_NAME}`,
          `${PLUGIN_Y}@${SHARED_HOST_NAME}`,
        ])
      );

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        marketplaceNames: [ALIAS_X],
      });

      const recorded = (await manifestRepo.load())?.getNativeRegistrations(claude);
      expect(recorded?.pluginRefs).toContain(`${PLUGIN_Y}@${SHARED_HOST_NAME}`);
      expect(recorded?.marketplaces).toContainEqual({
        alias: ALIAS_Y,
        hostName: SHARED_HOST_NAME,
        provenance: { kind: "registry", source: "/built/by-alias/shared" },
      });
    });
  });
});
