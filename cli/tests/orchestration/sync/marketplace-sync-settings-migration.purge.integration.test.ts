import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RegisterFrameworkMarketplace,
  type RegisterFrameworkMarketplaceCommand,
} from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { BUILT_CACHE_SUBDIR } from "../../../src/shared/domain/layout/aidd-layout.js";
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
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  CATALOG_RELATIVE,
  CLAUDE_BUILT_DIR,
  catalogFixture,
  freshClaudeSource,
  manifestWithClaude,
  PROJECT_ROOT,
  readableHostPlugins,
} from "../testing/marketplace-sync-settings-migration.builder.js";

describe("settings migration: stale cache purge", () => {
  describe("SyncSettings — purging this project's own pre-migration cache", () => {
    const OLD_CACHE_DIR = join(PROJECT_ROOT, BUILT_CACHE_SUBDIR, FRAMEWORK_MARKETPLACE_NAME);
    const OLD_CACHE_FILE = join(OLD_CACHE_DIR, "claude", "agents", "some-agent.md");

    function projectWithMigratableEntry(): InMemoryMarketplaceRegistry {
      const registry = new InMemoryMarketplaceRegistry();
      registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      return registry;
    }

    it("deletes the project's own stale built tree once the run completes without error", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      const fs = fsAt(PROJECT_ROOT, {
        [OLD_CACHE_FILE]: "stale content",
        [`${CLAUDE_BUILT_DIR}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(fs.has(OLD_CACHE_FILE)).toBe(false);
    });

    // A tool whose binary is off `PATH` never reaches `activateTool`, so its host registration gets
    // no chance to move off this project's pre-migration cache; purging it would leave it dangling.
    it("keeps the stale built tree in place, and warns, when a requested tool's binary is off PATH", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: false });
      const fs = fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" });
      const logger = new CapturingLogger();
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(result.errors).toEqual([]);
      expect(result.binaryMissing).toEqual([{ toolId: TOOL.claude, binary: "claude" }]);
      expect(fs.has(OLD_CACHE_FILE)).toBe(true);
      expect(
        logger.warnMessages.some((w) => w.includes("pre-migration framework cache kept"))
      ).toBe(true);
    });

    // A build that fails is warned about and skipped, never an error, so the host's registration is
    // left where it was. Same hazard as a missing binary, same answer.
    it("keeps the stale built tree in place, and warns, when a requested tool's build failed", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "." },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: true });
      const fs = fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" });
      const logger = new CapturingLogger();
      const failingBuild = {
        execute: async () => {
          throw new Error("translator refused the source");
        },
      };
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: failingBuild,
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(result.errors).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(fs.has(OLD_CACHE_FILE)).toBe(true);
      expect(
        logger.warnMessages.some((w) => w.includes("pre-migration framework cache kept"))
      ).toBe(true);
    });

    it("leaves the stale built tree in place when this run reports an error", async () => {
      const registry = projectWithMigratableEntry();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({
        available: true,
        enablesPlugins: false,
        crashOnAddMarketplace: false,
      });
      // No catalog seeded at the built dir, so `registerMarketplace` throws
      // `UnreadableBuiltCatalogError`, which `activateNativeTools` collects as a genuine error.
      const fs = fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" });
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(fs.has(OLD_CACHE_FILE)).toBe(true);
    });

    it("never deletes a candidate a symlink resolves outside the project root", async () => {
      const registry = projectWithMigratableEntry();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      const escapedFile = "/etc/evil/still-here.txt";
      const fs = fsAt(PROJECT_ROOT, {
        [escapedFile]: "not aidd's to delete",
        [`${CLAUDE_BUILT_DIR}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      fs.setSymlink(OLD_CACHE_DIR, "/etc/evil");
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(fs.has(escapedFile)).toBe(true);
    });

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
        enablesPlugins(): boolean {
          return false;
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
      manifest.addTool(TOOL.claude, "test", []);
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
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        nativeSources: new Map([
          [
            TOOL.claude,
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

    function registryWithSharedFramework(): InMemoryMarketplaceRegistry {
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
      return registry;
    }

    function staleCacheAndCatalog(): InMemoryFileAdapter {
      return fsAt(PROJECT_ROOT, {
        [OLD_CACHE_FILE]: "stale content",
        ...catalogFixture(CLAUDE_BUILT_DIR),
      });
    }

    function recordingRegister(
      calls: RegisterFrameworkMarketplaceCommand[]
    ): Pick<RegisterFrameworkMarketplace, "execute"> {
      return {
        execute: async (options) => {
          calls.push(options);
          return { registered: true, scope: "user" };
        },
      };
    }

    it("warns with the whole message when a requested tool's binary is off PATH", async () => {
      const logger = new CapturingLogger();
      const registry = projectWithMigratableEntry();
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" }),
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.claude, new FakeHostActions({ available: false })]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(logger.warnMessages).toStrictEqual([
        "claude CLI not found on PATH — skipping native plugin activation.",
        "This project's own pre-migration framework cache kept: a requested tool's CLI was not on PATH this run, so its own registration may still point at it — run `aidd sync` again once every tool's CLI is on PATH.",
      ]);
    });

    it("warns with the whole message when a requested tool's build failed", async () => {
      const logger = new CapturingLogger();
      const registry = projectWithMigratableEntry();
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, { [OLD_CACHE_FILE]: "stale content" }),
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.claude, new FakeHostActions({ available: true })]]),
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
        "Native plugin activation — build 'aidd-framework' for claude skipped: translator refused the source",
        "Native plugin activation — build 'aidd-framework' for claude skipped: translator refused the source",
        "This project's own pre-migration framework cache kept: a requested tool's build failed this run, so its own registration may still point at it — fix the build warning above, then run `aidd sync` again.",
      ]);
    });

    it("keeps the stale built tree when one of two requested tools' builds failed", async () => {
      const registry = projectWithMigratableEntry();
      const manifest = manifestWithClaude();
      manifest.addTool(TOOL.codex, "test", []);
      const fs = staleCacheAndCatalog();
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      const codexBuildFails: BuiltMarketplaceEnsurer = {
        execute: async (options) => {
          if (options.target === "codex") throw new Error("translator refused the source");
          return { builtDir: CLAUDE_BUILT_DIR, version: "test", rebuilt: true };
        },
      };
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([
          [TOOL.claude, activator],
          [TOOL.codex, activator],
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
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        nativeSources: freshClaudeSource(activator, CLAUDE_BUILT_DIR),
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
        fs: staleCacheAndCatalog(),
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([
          [TOOL.claude, new FakeHostActions({ available: true, enablesPlugins: false })],
        ]),
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

    it("leaves the stale built tree alone at user scope, where no project file is this run's to touch", async () => {
      const fs = staleCacheAndCatalog();
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registryWithSharedFramework(),
        logger: new CapturingLogger(),
        activators: new Map([
          [TOOL.claude, new FakeHostActions({ available: true, enablesPlugins: false })],
        ]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
        scope: "user",
      });

      expect(result.errors).toStrictEqual([]);
      expect(fs.has(OLD_CACHE_FILE)).toBe(true);
    });

    it("leaves the stale built tree alone unless the caller asked to recreate the framework entry", async () => {
      const fs = staleCacheAndCatalog();
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registryWithSharedFramework(),
        logger: new CapturingLogger(),
        activators: new Map([
          [TOOL.claude, new FakeHostActions({ available: true, enablesPlugins: false })],
        ]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(result.errors).toStrictEqual([]);
      expect(fs.has(OLD_CACHE_FILE)).toBe(true);
    });

    it("leaves the stale built tree alone while the framework entry is still at project scope", async () => {
      const fs = staleCacheAndCatalog();
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: projectWithMigratableEntry(),
        logger: new CapturingLogger(),
        activators: new Map([
          [TOOL.claude, new FakeHostActions({ available: true, enablesPlugins: false })],
        ]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(result.errors).toStrictEqual([]);
      expect(fs.has(OLD_CACHE_FILE)).toBe(true);
    });

    it("never re-registers the framework when it is already shared behind another project-scope marketplace", async () => {
      const registry = registryWithSharedFramework();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "other-plugins",
          source: { kind: "local", path: "/other/plugins" },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const calls: RegisterFrameworkMarketplaceCommand[] = [];
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, catalogFixture(CLAUDE_BUILT_DIR)),
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: recordingRegister(calls),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(calls).toStrictEqual([]);
    });

    it("neither registers nor fails when other marketplaces exist and no framework entry does", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "other-plugins",
          source: { kind: "local", path: "/other/plugins" },
          scope: "project",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const calls: RegisterFrameworkMarketplaceCommand[] = [];
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, catalogFixture(CLAUDE_BUILT_DIR)),
        manifestRepo: new InMemoryManifestRepository(manifestWithClaude()),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: recordingRegister(calls),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      expect(calls).toStrictEqual([]);
      expect((await registry.list(PROJECT_ROOT)).map((m) => m.name)).toStrictEqual([
        "other-plugins",
      ]);
    });
  });
});
