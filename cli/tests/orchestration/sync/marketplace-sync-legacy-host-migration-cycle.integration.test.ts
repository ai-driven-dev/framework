import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostRefusal } from "../../../src/contexts/host-registration/domain/native-refusal.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../src/shared/domain/layout/aidd-layout.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { hostInspector } from "../../shared/testing/host-inspector.builder.js";
import { fsAt } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  SYNTHETIC_TOOL,
  syntheticNativeCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import { buildCheckRegistration } from "../testing/build-check-registration.builder.js";
import {
  canonicallyOwned,
  PROJECT_ROOT,
  readableHostPlugins,
} from "../testing/marketplace-sync-settings-migration.builder.js";

const tool = SYNTHETIC_TOOL;
const CATALOG_RELATIVE = ".plugin/marketplace.json";

describe("settings migration: legacy host entries", () => {
  describe("SyncSettings + CheckRegistration - the full migration cycle", () => {
    /** Reads live from a `Map` the test's own activator double mutates on `addMarketplace`, the
     * one double that lets a `doctor` call made after a `sync` see what that `sync` actually did. */
    class LiveHostMarketplaceRegistryReader {
      constructor(
        private readonly entries: Map<string, string>,
        private readonly location: string
      ) {}
      async read() {
        return { location: this.location, entries: new Map(this.entries) };
      }
    }

    class RegisteringActivator implements HostActions {
      constructor(private readonly hostEntries: Map<string, string>) {}
      isAvailable(): boolean {
        return true;
      }
      addMarketplace(source: string): HostRefusal {
        this.hostEntries.set(FRAMEWORK_MARKETPLACE_NAME, source);
        return undefined;
      }
      removeMarketplace(): HostRefusal {
        return undefined;
      }
      registrationState(): "live" | "dead" | "unknown" {
        return "unknown";
      }
      upgradeMarketplaces(): HostRefusal {
        return undefined;
      }
      refsInstalledFrom(): readonly string[] {
        return [];
      }
      enablePlugin(): HostRefusal {
        return undefined;
      }
      updatePlugin(): HostRefusal {
        return undefined;
      }
      uninstallPlugin(): HostRefusal {
        return undefined;
      }
    }

    it("goes from doctor warning to doctor healthy across one sync, leaving another project's own marketplace untouched", async () => {
      const PROJECT_A = "/project-a";
      const PROJECT_B = "/project-b";
      const REGISTRY_LOCATION = `/home/.${tool}/known_marketplaces.json`;
      const CURRENT_VERSION = "2.0.0";
      // resolve(): doctor's `resolvedBuiltDir()` and the sync guard's `realpath(builtDir)` both
      // compare against a resolved path, so a drive-less key is never looked up on win32.
      const USER_CACHE_ROOT = resolve("/user-cache");
      const sharedBuiltDir = resolve(
        userBuiltMarketplaceDir({
          userConfigDir: USER_CACHE_ROOT,
          cliVersion: CURRENT_VERSION,
          marketplaceName: FRAMEWORK_MARKETPLACE_NAME,
          target: tool,
        })
      );
      const preMigrationCache = resolve(
        builtMarketplaceDir(PROJECT_A, FRAMEWORK_MARKETPLACE_NAME, tool)
      );

      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_A,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      await registry.save(
        PROJECT_B,
        Marketplace.create({
          name: "project-b-plugins",
          source: { kind: "local", path: "/project-b/plugins" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );

      const hostEntries = new Map<string, string>([
        [FRAMEWORK_MARKETPLACE_NAME, preMigrationCache],
      ]);
      const hostReader = new LiveHostMarketplaceRegistryReader(hostEntries, REGISTRY_LOCATION);
      const manifest = Manifest.create();
      manifest.addTool(tool, "test", []);

      const doctor = buildCheckRegistration(
        fsAt(PROJECT_ROOT, {
          [`${sharedBuiltDir}/${CATALOG_RELATIVE}`]: JSON.stringify({
            name: FRAMEWORK_MARKETPLACE_NAME,
            plugins: [],
          }),
        }),
        registry,
        () => false,
        hostInspector(syntheticNativeCatalog(tool), {
          fs: fsAt(PROJECT_ROOT, {
            [`${sharedBuiltDir}/${CATALOG_RELATIVE}`]: JSON.stringify({
              name: FRAMEWORK_MARKETPLACE_NAME,
              plugins: [],
            }),
          }),
          pluginRegistries: new Map(),
          marketplaceRegistries: new Map([[tool, hostReader]]),
        }),
        () => USER_CACHE_ROOT,
        CURRENT_VERSION,
        syntheticNativeCatalog(tool)
      );

      const before = await doctor.execute({
        manifest,
        projectRoot: PROJECT_A,
        allowedIds: null,
      });
      expect(
        before.some(
          (issue) => typeof issue.fix !== "string" && issue.fix.code === "sync-migrate-source"
        )
      ).toBe(true);

      const activator = new RegisteringActivator(hostEntries);
      const syncFs = fsAt(PROJECT_ROOT, {
        [`${sharedBuiltDir}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: CURRENT_VERSION,
          plugins: [],
        }),
        [`${preMigrationCache}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const machine = canonicallyOwned(tool);
      machine.records.set(tool, {
        binary: tool,
        marketplaces: [
          {
            alias: FRAMEWORK_MARKETPLACE_NAME,
            hostName: FRAMEWORK_MARKETPLACE_NAME,
            provenance: { kind: "registry", source: preMigrationCache },
          },
        ],
        pluginRefs: [],
        pluginClaims: [],
      });
      const sync = marketplaceSync({
        tools: syntheticNativeCatalog(tool),
        fs: syncFs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[tool, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir),
        hostMarketplaceRegistries: new Map([[tool, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
        currentVersion: CURRENT_VERSION,
        hostPluginRegistries: readableHostPlugins(tool),
        userManifestRepo: machine,
        nativeSources: new Map([
          [
            tool,
            {
              read: async () => ({
                location: REGISTRY_LOCATION,
                entries: new Map(
                  [...hostEntries].map(([name, source]) => [
                    name,
                    { kind: "registry" as const, source },
                  ])
                ),
              }),
            },
          ],
        ]),
      });

      const syncResult = await sync.execute({
        projectRoot: PROJECT_A,
        recreateFrameworkIfMissing: true,
      });
      expect(syncResult.errors).toEqual([]);

      const after = await doctor.execute({
        manifest,
        projectRoot: PROJECT_A,
        allowedIds: null,
      });
      expect(after).toEqual([]);

      const projectBEntries = await registry.list(PROJECT_B);
      expect(projectBEntries.map((m) => m.name)).toContain("project-b-plugins");
    });
  });
});
