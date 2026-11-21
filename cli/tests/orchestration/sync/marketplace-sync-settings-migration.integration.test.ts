import { describe, expect, it } from "vitest";
import { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { fsAt } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  CATALOG_RELATIVE,
  CLAUDE_BUILT_DIR,
  CODEX_BUILT_DIR,
  canonicallyOwned,
  catalogFixture,
  freshClaudeSource,
  PROJECT_ROOT,
  projectScopeEntry,
  readableHostPlugins,
} from "../testing/marketplace-sync-settings-migration.builder.js";

describe("settings migration", () => {
  describe("SyncSettings — sync migrates a project installed before the shared source", () => {
    it("preserves the existing entry's own source when migrating it from project to user scope, never falling back to the local default", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        projectScopeEntry({ kind: "github", repo: "ai-driven-dev/framework", ref: "v1" })
      );
      const manifest = Manifest.create();
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, catalogFixture(CLAUDE_BUILT_DIR)),
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      const entries = await registry.list(PROJECT_ROOT);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.scope).toBe("user");
      expect(entries[0]?.source).toEqual({
        kind: "github",
        repo: "ai-driven-dev/framework",
        ref: "v1",
      });
    });

    it("registers the framework at user scope even when the project-scope entry is the only one present — not only when the registry is empty", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(PROJECT_ROOT, projectScopeEntry({ kind: "local", path: "/some/path" }));
      const manifest = Manifest.create();
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, catalogFixture(CLAUDE_BUILT_DIR)),
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        marketplaceRegisterFrameworkUseCase: new RegisterFrameworkMarketplace(registry),
      });

      await useCase.execute({
        projectRoot: PROJECT_ROOT,
        recreateFrameworkIfMissing: true,
      });

      const entries = await registry.list(PROJECT_ROOT);
      expect(entries).toEqual([expect.objectContaining({ scope: "user" })]);
    });
  });

  describe("SyncSettings — codex and copilot refuse the same name from a different source", () => {
    function frameworkAtUserScope(): Marketplace {
      return Marketplace.create({
        name: FRAMEWORK_MARKETPLACE_NAME,
        source: { kind: "local", path: "." },
        scope: "user",
        addedAt: "2026-01-01T00:00:00Z",
      });
    }

    it("refuses force reclaim for Codex even with an AIDD claim when host source is unreadable", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(PROJECT_ROOT, frameworkAtUserScope());
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "test", []);
      const activator = new FakeHostActions({
        available: true,
        enablesPlugins: false,
        conflictOnAdd: true,
      });
      const fs = fsAt(PROJECT_ROOT, {
        [`${CODEX_BUILT_DIR}/.agents/plugins/marketplace.json`]: JSON.stringify({
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
        activators: new Map([[TOOL.codex, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CODEX_BUILT_DIR),
        hostPluginRegistries: readableHostPlugins(TOOL.codex),
        userManifestRepo: new InMemoryManifestRepository(canonicallyOwned(TOOL.codex)),
        nativeSources: new Map([
          [
            TOOL.codex,
            { read: async () => ({ location: "/host/codex/catalogues", unreadable: "EACCES" }) },
          ],
        ]),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.forcedRemovals).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.warnings.join("\n")).toContain("EACCES");
    });

    it("refuses an unproven reserved-name registration without force reclaim", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(PROJECT_ROOT, frameworkAtUserScope());
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "test", []);
      const activator = new FakeHostActions({
        available: true,
        enablesPlugins: false,
        conflictOnAdd: true,
      });
      const fs = fsAt(PROJECT_ROOT, {
        [`${CODEX_BUILT_DIR}/.agents/plugins/marketplace.json`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const logger = new CapturingLogger();
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.codex, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CODEX_BUILT_DIR),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.warnings).toEqual([
        expect.stringContaining("host source reader unavailable; reconcile manually"),
      ]);
      expect(logger.warnMessages).toEqual(result.warnings);
    });

    it("never reclaims an arbitrary, non-reserved marketplace name this way — only the framework's own", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "someones-plugins",
          source: { kind: "local", path: "." },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "test", []);
      const activator = new FakeHostActions({
        available: true,
        enablesPlugins: false,
        conflictOnAdd: true,
      });
      const builtDir = "/shared/built/other/codex";
      const fs = fsAt(PROJECT_ROOT, {
        [`${builtDir}/.agents/plugins/marketplace.json`]: JSON.stringify({
          name: "someones-plugins",
          version: "1.0.0",
          plugins: [],
        }),
      });
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.codex, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => builtDir),
      });

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
    });

    // `isUnguardedFrameworkMarketplace` excludes a tool declaring its own marketplace registry
    // from the reclaim door: a registry conflict is a reported error, never a silent remove-add.
    it("does not force reclaim a reserved name that Claude's registry points at a foreign source", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(PROJECT_ROOT, frameworkAtUserScope());
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({
        available: true,
        enablesPlugins: false,
        conflictOnAdd: true,
      });
      const fs = fsAt(PROJECT_ROOT, {
        [`${CLAUDE_BUILT_DIR}/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [],
        }),
        [`/foreign/cache/${CATALOG_RELATIVE}`]: JSON.stringify({
          name: FRAMEWORK_MARKETPLACE_NAME,
          version: "1.0.0",
          plugins: [{ name: "foreign-plugin" }],
        }),
      });
      // No `hostMarketplaceRegistries` reader for claude: `guardAgainstConflict` returns
      // "proceed" without reading one, so the exclusion is decided in `reclaimOrReport`.
      const useCase = marketplaceSync({
        fs,
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        hostMarketplaceRegistries: new Map([
          [
            TOOL.claude,
            new FakeHostMarketplaceRegistry({
              location: "/host/claude/known_marketplaces.json",
              entries: new Map([[FRAMEWORK_MARKETPLACE_NAME, "/foreign/cache"]]),
            }),
          ],
        ]),
        hostPluginRegistries: readableHostPlugins(TOOL.claude),
        nativeSources: new Map([
          [
            TOOL.claude,
            {
              read: async () => ({
                location: "/host/claude/catalogues",
                entries: new Map([
                  [
                    FRAMEWORK_MARKETPLACE_NAME,
                    { kind: "registry" as const, source: "/foreign/cache" },
                  ],
                ]),
              }),
            },
          ],
        ]),
      });

      const result = await useCase.execute({
        projectRoot: PROJECT_ROOT,
      });

      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(render(result.errors[0]?.error)).toContain("different catalog");
      expect(render(result.errors[0]?.error)).toContain("/foreign/cache");
    });
  });

  describe("SyncSettings — fresh Claude host provenance", () => {
    async function syncWithHostRegistry(reading: { absent?: true; unreadable?: string }) {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(PROJECT_ROOT, projectScopeEntry({ kind: "local", path: "." }));
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const activator = new FakeHostActions({ available: true, enablesPlugins: false });
      const logger = new CapturingLogger();
      const useCase = marketplaceSync({
        fs: fsAt(PROJECT_ROOT, catalogFixture(CLAUDE_BUILT_DIR)),
        manifestRepo: new InMemoryManifestRepository(manifest),
        marketplaceRegistry: registry,
        logger,
        activators: new Map([[TOOL.claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(() => CLAUDE_BUILT_DIR),
        hostMarketplaceRegistries: new Map([
          [
            TOOL.claude,
            new FakeHostMarketplaceRegistry({
              location: "/home/.claude/plugins/known_marketplaces.json",
              ...reading,
            }),
          ],
        ]),
        hostPluginRegistries: new Map([
          [
            TOOL.claude,
            new FakeHostPluginRegistry({
              location: "/home/.claude/plugins/installed_plugins.json",
              absent: true,
            }),
          ],
        ]),
        nativeSources: freshClaudeSource(activator, CLAUDE_BUILT_DIR),
      });

      return {
        activator,
        logger,
        result: await useCase.execute({ projectRoot: PROJECT_ROOT }),
      };
    }

    it("adds a fresh catalogue when the host registry is explicitly absent", async () => {
      const { activator, result } = await syncWithHostRegistry({ absent: true });

      expect(activator.addedMarketplaces).toEqual([CLAUDE_BUILT_DIR]);
      expect(result.warnings).toEqual([]);
    });

    it("does not add when the host registry exists but cannot be read", async () => {
      const { activator, logger, result } = await syncWithHostRegistry({ unreadable: "EACCES" });

      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.warnings.join("\n")).toContain("host registry is unreadable");
      expect(logger.warnMessages).toEqual(result.warnings);
    });
  });
});
