import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import {
  fsAt,
  type InMemoryFileAdapter,
} from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { registeredHostInspector } from "../../shared/testing/registered-host-inspector.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { buildCheckRegistration } from "../testing/build-check-registration.builder.js";
import {
  CATALOG_RELATIVE,
  canonicallyOwned,
  fakeVersion,
  noSourceReferences,
  PROJECT_ROOT,
  readableHostPlugins,
} from "../testing/marketplace-sync-settings-migration.builder.js";

describe("settings migration: legacy host entries", () => {
  describe("SyncSettings — the host still tracks another, unmigrated project's cache", () => {
    const USER_CACHE_ROOT = "/user-cache";
    const CURRENT_VERSION = "2.0.0";

    function sharedBuiltDir(): string {
      return userBuiltMarketplaceDir({
        userConfigDir: USER_CACHE_ROOT,
        cliVersion: CURRENT_VERSION,
        marketplaceName: FRAMEWORK_MARKETPLACE_NAME,
        target: "claude",
      });
    }

    it("leaves another project's cache and both references untouched without source provenance", async () => {
      const foreignProjectCache = builtMarketplaceDir(
        "/other-project",
        FRAMEWORK_MARKETPLACE_NAME,
        "claude"
      );
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      const fs = fsAt(PROJECT_ROOT, {
        [`${sharedBuiltDir()}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: CURRENT_VERSION,
          plugins: [],
        }),
        // The foreign project's own directory still exists, which a host registry pointing there
        // implies, so its claim on the shared source is worth recording.
        [`${foreignProjectCache}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const hostReader = new FakeHostMarketplaceRegistry({
        location: "/home/.claude/plugins/known_marketplaces.json",
        entries: new Map([[FRAMEWORK_MARKETPLACE_NAME, foreignProjectCache]]),
      });
      const added: Array<{ version: string; projectRoot: string }> = [];
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir()),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        userSourceReferences: noSourceReferences(added),
        currentVersionProvider: fakeVersion(CURRENT_VERSION),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        userManifestRepo: new InMemoryManifestRepository(canonicallyOwned(TOOL.claude)),
      });

      const before = await fs.readFile(`${foreignProjectCache}/${CATALOG_RELATIVE}`);
      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.addedMarketplaces).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(added).toEqual([]);
      expect(await fs.readFile(`${foreignProjectCache}/${CATALOG_RELATIVE}`)).toBe(before);
      expect(result.warnings.join("\n")).toContain("host source unproven");
    });

    it("does not infer ownership or add references when the old project root is gone", async () => {
      const foreignProjectCache = builtMarketplaceDir(
        "/gone-project",
        FRAMEWORK_MARKETPLACE_NAME,
        "claude"
      );
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      // Nothing is seeded under `foreignProjectCache` at all — the directory a real
      // `rm -rf` would have removed after the fact.
      const fs = fsAt(PROJECT_ROOT, {
        [`${sharedBuiltDir()}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: CURRENT_VERSION,
          plugins: [],
        }),
      });
      const hostReader = new FakeHostMarketplaceRegistry({
        location: "/home/.claude/plugins/known_marketplaces.json",
        entries: new Map([[FRAMEWORK_MARKETPLACE_NAME, foreignProjectCache]]),
      });
      const added: Array<{ version: string; projectRoot: string }> = [];
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir()),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        userSourceReferences: noSourceReferences(added),
        currentVersionProvider: fakeVersion(CURRENT_VERSION),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        userManifestRepo: new InMemoryManifestRepository(canonicallyOwned(TOOL.claude)),
      });

      const before = await fs.readFile(`${sharedBuiltDir()}/${CATALOG_RELATIVE}`);
      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.addedMarketplaces).toEqual([]);
      expect(added).toEqual([]);
      expect(await fs.readFile(`${sharedBuiltDir()}/${CATALOG_RELATIVE}`)).toBe(before);
      expect(result.warnings.join("\n")).toContain("host source unproven");
    });

    function hostOnForeignCache(): {
      fs: InMemoryFileAdapter;
      hostReader: FakeHostMarketplaceRegistry;
      registry: InMemoryMarketplaceRegistry;
      manifest: Manifest;
      activator: FakeHostActions;
    } {
      const foreignProjectCache = builtMarketplaceDir(
        "/other-project",
        FRAMEWORK_MARKETPLACE_NAME,
        "claude"
      );
      const registry = new InMemoryMarketplaceRegistry();
      registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const fs = fsAt(PROJECT_ROOT, {
        [`${sharedBuiltDir()}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: CURRENT_VERSION,
          plugins: [],
        }),
        [`${foreignProjectCache}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const hostReader = new FakeHostMarketplaceRegistry({
        location: "/home/.claude/plugins/known_marketplaces.json",
        entries: new Map([[FRAMEWORK_MARKETPLACE_NAME, foreignProjectCache]]),
      });
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      return { fs, hostReader, registry, manifest, activator };
    }

    it("does not repoint a legacy host entry when no reference ledger is available", async () => {
      const { fs, hostReader, registry, manifest, activator } = hostOnForeignCache();
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir()),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        userManifestRepo: new InMemoryManifestRepository(canonicallyOwned(TOOL.claude)),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.errors).toStrictEqual([]);
      expect(activator.addedMarketplaces).toStrictEqual([]);
      expect(activator.removedMarketplaces).toStrictEqual([]);
      expect(result.warnings.join("\n")).toContain("host source unproven");
    });

    it("does not repoint or record a legacy host entry when the version is unknown", async () => {
      const { fs, hostReader, registry, manifest, activator } = hostOnForeignCache();
      const added: Array<{ version: string; projectRoot: string }> = [];
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir()),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        userSourceReferences: noSourceReferences(added),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        userManifestRepo: new InMemoryManifestRepository(canonicallyOwned(TOOL.claude)),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.errors).toStrictEqual([]);
      expect(activator.addedMarketplaces).toStrictEqual([]);
      expect(activator.removedMarketplaces).toStrictEqual([]);
      expect(result.warnings.join("\n")).toContain("host source unproven");
      expect(added).toStrictEqual([]);
    });
  });

  describe("SyncSettings + CheckRegistration — the full migration cycle", () => {
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
      enablesPlugins(): boolean {
        return false;
      }
      addMarketplace(source: string): void {
        this.hostEntries.set(FRAMEWORK_MARKETPLACE_NAME, source);
      }
      removeMarketplace(): void {}
      registrationState(): "live" | "dead" | "unknown" {
        return "unknown";
      }
      upgradeMarketplaces(): void {}
      enablePlugin(): void {}
      updatePlugin(): void {}
      uninstallPlugin(): void {}
    }

    it("goes from doctor warning to doctor healthy across one sync, leaving another project's own marketplace untouched", async () => {
      const PROJECT_A = "/project-a";
      const PROJECT_B = "/project-b";
      const REGISTRY_LOCATION = "/home/.claude/plugins/known_marketplaces.json";
      const CURRENT_VERSION = "2.0.0";
      // resolve(): doctor's `resolvedBuiltDir()` and the sync guard's `realpath(builtDir)` both
      // compare against a resolved path, so a drive-less key is never looked up on win32.
      const USER_CACHE_ROOT = resolve("/user-cache");
      const sharedBuiltDir = resolve(
        userBuiltMarketplaceDir({
          userConfigDir: USER_CACHE_ROOT,
          cliVersion: CURRENT_VERSION,
          marketplaceName: FRAMEWORK_MARKETPLACE_NAME,
          target: "claude",
        })
      );
      const preMigrationCache = resolve(
        builtMarketplaceDir(PROJECT_A, FRAMEWORK_MARKETPLACE_NAME, "claude")
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
      manifest.addTool(TOOL.claude, "test", []);

      const doctor = buildCheckRegistration(
        fsAt(PROJECT_ROOT, {
          [`${sharedBuiltDir}/${CATALOG_RELATIVE}`]: JSON.stringify({
            name: FRAMEWORK_MARKETPLACE_NAME,
            plugins: [],
          }),
        }),
        registry,
        () => false,
        registeredHostInspector(
          fsAt(PROJECT_ROOT, {
            [`${sharedBuiltDir}/${CATALOG_RELATIVE}`]: JSON.stringify({
              name: FRAMEWORK_MARKETPLACE_NAME,
              plugins: [],
            }),
          }),
          new Map(),
          new Map([[TOOL.claude, hostReader]])
        ),
        () => USER_CACHE_ROOT,
        fakeVersion(CURRENT_VERSION),
        registeredTools()
      );

      const before = await doctor.execute({
        manifest,
        projectRoot: PROJECT_A,
        allowedIds: null,
      });
      expect(before.some((issue) => issue.fix.includes("aidd sync"))).toBe(true);

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
      const machine = canonicallyOwned(TOOL.claude);
      machine.setNativeRegistrations(TOOL.claude, {
        binary: "claude",
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
        fs: syncFs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
        currentVersionProvider: fakeVersion(CURRENT_VERSION),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        userManifestRepo: new InMemoryManifestRepository(machine),
        nativeSources: new Map([
          [
            TOOL.claude,
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
