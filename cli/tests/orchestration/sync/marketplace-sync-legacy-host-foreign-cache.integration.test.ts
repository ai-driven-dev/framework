import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
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
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  CATALOG_RELATIVE,
  canonicallyOwned,
  noSourceReferences,
  PROJECT_ROOT,
  readableHostPlugins,
} from "../testing/marketplace-sync-settings-migration.builder.js";

describe("settings migration: legacy host entries", () => {
  describe("SyncSettings - the host still tracks another, unmigrated project's cache", () => {
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
      await registry.seed(
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
      const activator = new FakeHostActions({ available: true });
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
        tools: registeredTools(),
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir()),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        userSourceReferences: noSourceReferences(added),
        currentVersion: CURRENT_VERSION,
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
      await registry.seed(
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
      const activator = new FakeHostActions({ available: true });
      // Nothing is seeded under `foreignProjectCache` at all - the directory a real
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
        tools: registeredTools(),
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => sharedBuiltDir()),
        hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
        userCacheRoot: () => USER_CACHE_ROOT,
        userSourceReferences: noSourceReferences(added),
        currentVersion: CURRENT_VERSION,
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
      registry.seed(
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
      const activator = new FakeHostActions({ available: true });
      return { fs, hostReader, registry, manifest, activator };
    }

    it("does not repoint a legacy host entry when no reference ledger is available", async () => {
      const { fs, hostReader, registry, manifest, activator } = hostOnForeignCache();
      const useCase = marketplaceSync({
        tools: registeredTools(),
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
        tools: registeredTools(),
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
});
