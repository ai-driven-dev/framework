import { describe, expect, it } from "vitest";
import { answeredRegistry } from "../../../src/contexts/host-registration/domain/reading/host-registration-answers.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../src/shared/domain/file.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  ActivatorThatWritesSettings,
  buildSync,
  claude,
  MARKETPLACE,
  manifestWithPlugin,
  marketplace,
  nativeSource,
  PLUGIN,
  PROJECT_ROOT,
  REF,
  readableHostPlugins,
  SETTINGS_PATH,
  seededBuiltCatalog,
  settingsPathIn,
} from "../testing/marketplace-sync-native-activation.builder.js";

describe("native activation", () => {
  describe("syncing settings registers the plugin with the host's own CLI", () => {
    it("drives the host CLI with the same ref the diagnostic looks up", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry } = buildSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.enabledPlugins).toContain(REF);
      expect(activator.enabledPlugins[0]).toBe(REF);
    });

    it("registers nothing when the host CLI is not available, and does not fail the sync", async () => {
      const activator = new FakeHostActions({ available: false });
      const { useCase, registry } = buildSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.enabledPlugins).toEqual([]);
    });

    // `mergeEnabledPlugins` skips a plugin whose marketplace does not resolve with a bare
    // `continue`, so it reaches neither a settings file nor the host CLI.
    it("registers nothing for a plugin whose marketplace does not resolve, and says nothing about it", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry } = buildSync(activator, "a-marketplace-nobody-added");
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.enabledPlugins).toEqual([]);
      const answered = answeredRegistry(claude, { location: "/registry", refs: new Map() }, true);

      expect("refs" in answered && answered.refs.has(`${PLUGIN}@a-marketplace-nobody-added`)).toBe(
        false
      );
    });
  });

  describe("nativeRegistrations reflects what the host's own CLI was asked to register", () => {
    it("records binary, marketplaces and pluginRefs after a successful activation", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo } = buildSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      const reloaded = await manifestRepo.load();
      expect(reloaded?.getNativeRegistrations(claude)).toEqual({
        binary: "claude",
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: { kind: "registry", source: "/built/claude" },
          },
        ],
        pluginRefs: [REF],
      });
    });

    it("records nothing when the host CLI is not available", async () => {
      const activator = new FakeHostActions({ available: false });
      const { useCase, registry, manifestRepo } = buildSync(activator);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      const reloaded = await manifestRepo.load();
      expect(reloaded?.getNativeRegistrations(claude)).toBeUndefined();
    });

    it("re-registers through the host CLI when the manifest's record has gone stale", async () => {
      const activator = new FakeHostActions({ available: true });
      const { useCase, registry, manifestRepo } = buildSync(activator);
      const staleManifest = await manifestRepo.load();
      staleManifest?.setNativeRegistrations(claude, {
        binary: "claude",
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: { kind: "registry", source: "/built/claude" },
          },
        ],
        pluginRefs: [REF],
      });
      if (staleManifest) await manifestRepo.save(staleManifest);
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.enabledPlugins).toContain(REF);
      const reloaded = await manifestRepo.load();
      expect(reloaded?.getNativeRegistrations(claude)).toEqual({
        binary: "claude",
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: { kind: "registry", source: "/built/claude" },
          },
        ],
        pluginRefs: [REF],
      });
    });

    // This project's local alias for a marketplace is free to differ from the name its catalog
    // declares, and `claude` only ever knows the marketplace by the catalog's own name.
    it("drives the host CLI and records the catalog's own name when this project's local alias differs from it", async () => {
      const CATALOG_NAME = "aidd-framework-catalog";
      const activator = new FakeHostActions({ available: true });
      const registry = new InMemoryMarketplaceRegistry();
      const fs = new InMemoryFileAdapter({
        "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
          name: CATALOG_NAME,
          version: "1.0.0",
          plugins: [],
        }),
      });
      const manifestRepo = manifestWithPlugin();
      const useCase = marketplaceSync({
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        hostPluginRegistries: readableHostPlugins(),
        nativeSources: nativeSource(activator, CATALOG_NAME),
      });
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.enabledPlugins).toEqual([`${PLUGIN}@${CATALOG_NAME}`]);
      expect(activator.enabledPlugins).not.toContain(REF);
      const reloaded = await manifestRepo.load();
      expect(reloaded?.getNativeRegistrations(claude)).toEqual({
        binary: "claude",
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: CATALOG_NAME,
            provenance: { kind: "registry", source: "/built/claude" },
          },
        ],
        pluginRefs: [`${PLUGIN}@${CATALOG_NAME}`],
      });
    });
  });

  // `buildSync` always installs a plugin, so a guard `if (refs.length === 0) return false;` at the
  // top of `activateTool` would still pass every other test in this file.
  describe("registering a marketplace does not wait for a plugin to point at it", () => {
    it("registers every known marketplace even when the manifest declares no plugin", async () => {
      const activator = new FakeHostActions({ available: true });
      const registry = new InMemoryMarketplaceRegistry();
      const fs = seededBuiltCatalog();
      const manifest = Manifest.create();
      manifest.addTool(claude, "test", []);
      const manifestRepo = new InMemoryManifestRepository(manifest);
      const useCase = marketplaceSync({
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        hostPluginRegistries: readableHostPlugins(),
        nativeSources: nativeSource(activator),
      });
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(activator.addedMarketplaces).not.toEqual([]);
    });
  });

  // Claude Code declares one `settingsPath` for both marketplaces and enabled plugins, so the
  // host's own CLI writes into the very file `syncTool` hashed just before activation ran.
  describe("what native activation leaves behind is not reported as the user's drift", () => {
    it("tracks a hash that still matches the settings file after the host CLI has written to it", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      const fs = seededBuiltCatalog();
      const manifestRepo = manifestWithPlugin();
      const settingsAbsolutePath = settingsPathIn(PROJECT_ROOT);
      const activator = new ActivatorThatWritesSettings(fs, settingsAbsolutePath);
      const useCase = marketplaceSync({
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([[claude, activator]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        hostPluginRegistries: readableHostPlugins(),
        nativeSources: nativeSource(activator),
      });
      await registry.save(PROJECT_ROOT, marketplace());

      await useCase.execute({ projectRoot: PROJECT_ROOT });
      // The port is synchronous and the host CLI's write is not, so let the writes the
      // activator queued actually land before reading the file back.
      await activator.settled();

      const onDisk = await fs.readFile(settingsAbsolutePath);
      const manifest = await manifestRepo.load();
      const tracked = manifest?.getToolFiles(claude) ?? [];
      const entry = tracked.find((file) => file.relativePath === SETTINGS_PATH);

      expect(entry, "the settings file is tracked at all").toBeDefined();
      expect(entry?.hash).toEqual(FileHash.of(onDisk));
    });
    // A tool whose CLI is not on the PATH wrote nothing, so a settings file differing from its
    // tracked hash differs because a person changed it — re-hashing would bless that as ours.
    it("leaves a hash alone for a tool whose own CLI never ran", async () => {
      const registry = new InMemoryMarketplaceRegistry();
      const fs = new InMemoryFileAdapter();
      const manifestRepo = manifestWithPlugin();
      const settingsAbsolutePath = settingsPathIn(PROJECT_ROOT);
      const useCase = marketplaceSync({
        fs,
        manifestRepo,
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: // Not available: the binary is not on the PATH, so nothing of the host's is written.
          new Map([[claude, new FakeHostActions({ available: false })]]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
      });
      await registry.save(PROJECT_ROOT, marketplace());
      await useCase.execute({ projectRoot: PROJECT_ROOT });
      const hashAfterSync = (await manifestRepo.load())
        ?.getToolFiles(claude)
        .find((file) => file.relativePath === SETTINGS_PATH)?.hash;

      const edited = `${await fs.readFile(settingsAbsolutePath)}\n`;
      await fs.writeFile(settingsAbsolutePath, edited);
      await useCase.execute({ projectRoot: PROJECT_ROOT });

      const tracked = (await manifestRepo.load())
        ?.getToolFiles(claude)
        .find((file) => file.relativePath === SETTINGS_PATH);
      expect(hashAfterSync, "the settings file is tracked at all").toBeDefined();
      expect(tracked?.hash).toEqual(hashAfterSync);
      expect(tracked?.hash).not.toEqual(FileHash.of(edited));
    });
  });

  // Asking about the local alias would answer "dead" for a registration the host holds live under
  // the catalog's own name, and then force-remove a name the host never held.
});
