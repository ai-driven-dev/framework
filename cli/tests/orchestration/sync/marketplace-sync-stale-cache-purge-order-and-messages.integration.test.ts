import { describe, expect, it } from "vitest";
import { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import {
  fsAt,
  type InMemoryFileAdapter,
} from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  CATALOG_RELATIVE,
  CLAUDE_BUILT_DIR,
  catalogFixture,
  freshClaudeSource,
  manifestWithClaude,
  PROJECT_ROOT,
  readableHostPlugins,
} from "../testing/marketplace-sync-settings-migration.builder.js";
import {
  OLD_CACHE_DIR,
  OLD_CACHE_FILE,
  projectWithMigratableEntry,
  staleCacheAndCatalog,
} from "../testing/stale-cache-purge.builder.js";

describe("SyncSettings - when the stale cache is purged and what it says", () => {
  it("purges only after native activation has run against the still-present cache, never before", async () => {
    class OrderObservingActivator implements HostActions {
      readonly cacheStillPresentAtAdd: boolean[] = [];
      addedSource?: string;
      constructor(
        private readonly fs: InMemoryFileAdapter,
        private readonly probe: string
      ) {}
      isAvailable(): boolean {
        return true;
      }
      addMarketplace(source: string): void {
        this.addedSource = source;
        this.cacheStillPresentAtAdd.push(this.fs.has(this.probe));
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

    const registry = projectWithMigratableEntry();
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_NATIVE_TOOL, "test", []);
    const fs = fsAt(PROJECT_ROOT, {
      [OLD_CACHE_FILE]: "stale content",
      [`${CLAUDE_BUILT_DIR}/${CATALOG_RELATIVE}`]: JSON.stringify({
        name: FRAMEWORK_MARKETPLACE_NAME,
        version: "1.0.0",
        plugins: [],
      }),
    });
    const activator = new OrderObservingActivator(fs, OLD_CACHE_FILE);
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      hostPluginRegistries: readableHostPlugins(SYNTHETIC_NATIVE_TOOL),
      nativeSources: new Map([
        [
          SYNTHETIC_NATIVE_TOOL,
          {
            read: async () => ({
              location: "/host/claude/catalogues",
              entries: new Map(
                activator.addedSource === undefined
                  ? []
                  : [
                      [
                        FRAMEWORK_MARKETPLACE_NAME,
                        { kind: "registry" as const, source: activator.addedSource },
                      ],
                    ]
              ),
            }),
          },
        ],
      ]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(activator.cacheStillPresentAtAdd).toEqual([true]);
    expect(fs.has(OLD_CACHE_FILE)).toBe(false);
  });

  it("warns with the whole message when a requested tool's binary is off PATH", async () => {
    const logger = new CapturingLogger();
    const registry = projectWithMigratableEntry();
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs: fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" }),
      manifestRepo: new InMemoryManifestRepository(manifestWithClaude(SYNTHETIC_NATIVE_TOOL)),
      marketplaceRegistry: registry,
      logger,
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, new FakeHostActions({ available: false })]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(logger.warnMessages).toStrictEqual([
      `${SYNTHETIC_NATIVE_TOOL} CLI not found on PATH — skipping native plugin activation.`,
      "This project's own pre-migration framework cache kept: a requested tool's CLI was not on PATH this run, so its own registration may still point at it — run `aidd sync` again once every tool's CLI is on PATH.",
    ]);
  });

  it("warns with the whole message when a requested tool's build failed", async () => {
    const logger = new CapturingLogger();
    const registry = projectWithMigratableEntry();
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs: fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" }),
      manifestRepo: new InMemoryManifestRepository(manifestWithClaude(SYNTHETIC_NATIVE_TOOL)),
      marketplaceRegistry: registry,
      logger,
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, new FakeHostActions({ available: true })]]),
      ensureBuilt: {
        execute: async () => {
          throw new Error("translator refused the source");
        },
      },
      marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(logger.warnMessages).toStrictEqual([
      `Native plugin activation — build 'aidd-framework' for ${SYNTHETIC_NATIVE_TOOL} skipped: Error: translator refused the source`,
      `Native plugin activation — build 'aidd-framework' for ${SYNTHETIC_NATIVE_TOOL} skipped: Error: translator refused the source`,
      "This project's own pre-migration framework cache kept: a requested tool's build failed this run, so its own registration may still point at it — fix the build warning above, then run `aidd sync` again.",
    ]);
  });

  it("keeps the stale built tree when one of two requested tools' builds failed", async () => {
    const registry = projectWithMigratableEntry();
    const manifest = manifestWithClaude(SYNTHETIC_NATIVE_TOOL);
    manifest.addTool(SYNTHETIC_LISTED_TOOL, "test", []);
    const fs = staleCacheAndCatalog();
    const activator = new FakeHostActions({ available: true });
    const codexBuildFails: BuiltMarketplaceEnsurer = {
      execute: async (options) => {
        if (options.target === SYNTHETIC_LISTED_TOOL)
          throw new Error("translator refused the source");
        return { builtDir: CLAUDE_BUILT_DIR, version: "test", rebuilt: true };
      },
    };
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([
        [SYNTHETIC_NATIVE_TOOL, activator],
        [SYNTHETIC_LISTED_TOOL, activator],
      ]),
      ensureBuilt: codexBuildFails,
      marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(result.errors).toStrictEqual([]);
    expect(fs.has(OLD_CACHE_FILE)).toBe(true);
  });

  it("names the candidate and the root it escaped when a symlink resolves it outside the project", async () => {
    const logger = new CapturingLogger();
    const registry = projectWithMigratableEntry();
    const fs = fsAt(PROJECT_ROOT, {
      "/etc/evil/still-here.txt": "not aidd's to delete",
      ...catalogFixture(CLAUDE_BUILT_DIR),
    });
    fs.setSymlink(OLD_CACHE_DIR, "/etc/evil");
    const activator = new FakeHostActions({ available: true });
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo: new InMemoryManifestRepository(manifestWithClaude(SYNTHETIC_NATIVE_TOOL)),
      marketplaceRegistry: registry,
      logger,
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      hostPluginRegistries: readableHostPlugins(SYNTHETIC_NATIVE_TOOL),
      nativeSources: freshClaudeSource(SYNTHETIC_NATIVE_TOOL, activator, CLAUDE_BUILT_DIR),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(logger.warnMessages).toStrictEqual([
      `This project's own pre-migration framework cache does not resolve inside ${PROJECT_ROOT}; left in place: ${OLD_CACHE_DIR}`,
    ]);
  });

  it("says which tree it purged", async () => {
    const logger = new CapturingLogger();
    const registry = projectWithMigratableEntry();
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs: staleCacheAndCatalog(),
      manifestRepo: new InMemoryManifestRepository(manifestWithClaude(SYNTHETIC_NATIVE_TOOL)),
      marketplaceRegistry: registry,
      logger,
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, new FakeHostActions({ available: true })]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });

    expect(logger.infoMessages).toStrictEqual([
      `This project's own pre-migration framework cache purged: ${OLD_CACHE_DIR}`,
    ]);
  });
});
