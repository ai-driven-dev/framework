import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wireHostRegistration } from "../../../src/composition/host-registration.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { AIDD_DIR } from "../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  buildUseCase,
  CLAUDE_CACHE_ROOT,
  CODEX_CACHE_ROOT,
  EXISTING_DIRECTORIES,
  HOME,
  MARKETPLACE,
  PROJECT_ROOT,
  REF,
  RealpathDeniedFileAdapter,
  RecordingFileAdapter,
  RegistryMirroringActivatorState,
  seedAiddMarketplaceRegistry,
  seedManifest,
} from "../testing/clean-native-cache.builder.js";
import {
  HOST,
  hostCacheRoot,
  hostCatalog,
  hostRegistrations,
} from "../testing/synthetic-hosts.builder.js";

describe("clean purges a host's own plugin cache: paths", () => {
  it("leaves claude's cache in place, and names it, when the claude CLI is not on PATH", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: false });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(reader.reads).toBe(0);
    // Not just that the cache survives - the output says where, the same absolute path the
    // dry-run preview would have announced.
    expect(
      logger.warnMessages.some(
        (m) => m.includes("not on the PATH") && m.includes(join(CLAUDE_CACHE_ROOT, MARKETPLACE))
      )
    ).toBe(true);
  });

  it("leaves claude's cache in place without trusting a registry read after host removal fails", async () => {
    // `removeMarketplace` throws (host refused, or the call failed for any other
    // reason `bestEffort` swallows), so the registry mirror never drops the name.
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: true, throwOnRemove: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    // Source preflight and undo recheck ran; failed removal never reached cache confirmation.
    expect(reader.reads).toBe(2);
    expect(logger.warnMessages.some((m) => m.includes("removal was not confirmed"))).toBe(true);
  });

  it("refuses project clean when Claude's current registry does not exist", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: true });
    const reader = new FakeHostMarketplaceRegistry({
      location: "known_marketplaces.json",
      absent: true,
    });
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await expect(useCase.execute({ projectRoot: PROJECT_ROOT, force: true })).rejects.toThrow(
      "absent on the host"
    );

    expect(fs.getFile(cacheEntry)).toBe("{}");
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("refuses project clean without deleting cache when Claude's registry is unreadable", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: true });
    const reader = new FakeHostMarketplaceRegistry({
      location: "known_marketplaces.json",
      unreadable: "EACCES",
    });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await expect(useCase.execute({ projectRoot: PROJECT_ROOT, force: true })).rejects.toThrow(
      "EACCES"
    );

    expect(fs.getFile(cacheEntry)).toBe("{}");
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.deletedDirectories).toEqual([]);
  });

  it("refuses project clean under the same HOME its registry reader proves absent", async () => {
    // A sentinel, never this machine's real home: a cache root composed from `os.homedir()`
    // directly ignores the injected `homeDir` and looks under the real home instead.
    const SENTINEL_HOME = "/sentinel-home-clean-cache-parity";
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(
      hostCacheRoot("claude", SENTINEL_HOME),
      MARKETPLACE,
      "plugin-a",
      "1.0.0",
      "plugin.json"
    );
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: true });
    // The real adapter, resolved from the same sentinel the cache root is composed from - a
    // fake reader built independently of `homeDir` could never catch the two halves drifting.
    const reader = wireHostRegistration(
      hostCatalog(),
      SENTINEL_HOME,
      hostRegistrations()
    ).marketplaceRegistries.get(HOST.claude);
    if (reader === undefined) throw new Error("claude must declare marketplaceRegistry");

    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
      homeDir: () => SENTINEL_HOME,
    });

    await expect(useCase.execute({ projectRoot: PROJECT_ROOT, force: true })).rejects.toThrow(
      "absent on the host"
    );

    // The real reader resolves the sentinel HOME, not the user's real registry.
    expect(fs.getFile(cacheEntry)).toBe("{}");
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("refuses a '..' cache path after proving the current host source", async () => {
    const hostName = "../../../evil";
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const witness = join(CLAUDE_CACHE_ROOT, hostName);
    // Written exactly where an unresolved join lands - so the guard is proven against the
    // collapse `path.join` already performs, not a path this test invents.
    await fs.writeFile(join(witness, "keep-me.txt"), "still here");

    const activator = new FakeHostActions({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [hostName],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, hostName, "safe-alias"),
      activator,
      binary: HOST.claude,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry("safe-alias"),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(await fs.fileExists(join(witness, "keep-me.txt"))).toBe(true);
    expect(fs.deletedDirectories).not.toContain(witness);
    expect(reader.reads).toBe(1);
    expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
  });

  it("refuses a cache entry that resolves outside the declared cache root through a symlink", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const candidate = join(CLAUDE_CACHE_ROOT, MARKETPLACE);
    fs.setSymlink(candidate, "/outside/evil-target");

    const activator = new FakeHostActions({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(fs.deletedDirectories).not.toContain(candidate);
    expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
  });

  it("keeps and names a cache path whose realpath fails with EACCES, without aborting the rest of clean", async () => {
    const candidate = join(CLAUDE_CACHE_ROOT, MARKETPLACE);
    const fs = new RealpathDeniedFileAdapter(candidate);
    const cacheEntry = join(candidate, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [MARKETPLACE],
      activator
    );
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.claude,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(true);
    expect(logger.warnMessages.some((m) => m.includes(candidate))).toBe(true);
    // removeAiddState sits well past the cache purge in execute()'s own order, so its
    // running is what proves nothing aborted mid-course.
    expect(fs.deletedDirectories).toContain(join(PROJECT_ROOT, AIDD_DIR, "cache"));
  });

  it("detaches a shared Copilot claim locally without a host source reader or HOME deletion", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const activator = new FakeHostActions({ available: true });
    const manifest = Manifest.create();
    manifest.addTool(HOST.copilot, "1.0.0", []);
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      manifest,
      records: new Map().set(HOST.copilot, {
        binary: HOST.copilot,
        marketplaces: [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
        pluginRefs: [REF],
      }),
      activator,
      binary: HOST.copilot,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE, "user"),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(fs.deletedDirectories.some((p) => p.startsWith(HOME))).toBe(false);
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("purges under the catalog's own hostName, never the project's local alias", async () => {
    const alias = "my-local-alias";
    const hostName = "upstream-catalog-name";
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CLAUDE_CACHE_ROOT, hostName, "plugin-a", "1.0.0", "plugin.json");
    await fs.writeFile(cacheEntry, "{}");

    const activator = new FakeHostActions({ available: true });
    const reader = new RegistryMirroringActivatorState(
      "known_marketplaces.json",
      [hostName],
      activator
    );
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.claude, hostName, alias),
      activator,
      binary: HOST.claude,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(alias),
      hostMarketplaceRegistries: new Map([[HOST.claude, reader]]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(await fs.fileExists(cacheEntry)).toBe(false);
    expect(fs.deletedDirectories).not.toContain(join(CLAUDE_CACHE_ROOT, alias));
  });

  it("purges codex's empty cache shell once its own CLI has removed the marketplace", async () => {
    // No reader registered for codex - its profile declares `pluginCacheDir` alone, no
    // `marketplaceRegistry`, so `purgeOneMarketplaceCache` proves emptiness instead.
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    await fs.createDirectory(join(CODEX_CACHE_ROOT, MARKETPLACE));
    const activator = new FakeHostActions({ available: true });
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: new InMemoryManifestRepository(Manifest.create()),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(fs.deletedDirectories).toContain(join(CODEX_CACHE_ROOT, MARKETPLACE));
  });

  it("leaves codex's cache in place, even empty, when marketplace removal was not confirmed", async () => {
    // Nothing under the cache directory - the shape `purgeCacheIfEmpty` reads as safe - while
    // `removeMarketplace` throws, so the host was never confirmed to have forgotten the name.
    const fs = new RecordingFileAdapter({}, [
      ...EXISTING_DIRECTORIES,
      join(CODEX_CACHE_ROOT, MARKETPLACE),
    ]);

    const activator = new FakeHostActions({ available: true, throwOnRemove: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: new InMemoryManifestRepository(Manifest.create()),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(fs.deletedDirectories).not.toContain(join(CODEX_CACHE_ROOT, MARKETPLACE));
    expect(logger.warnMessages.some((m) => m.includes("its own removal was not confirmed"))).toBe(
      true
    );
  });

  it("leaves codex's cache in place, and names it, when it still holds content", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const leftover = join(CODEX_CACHE_ROOT, MARKETPLACE, "leftover.txt");
    await fs.writeFile(leftover, "still here");

    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      ...seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger,
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: new InMemoryManifestRepository(Manifest.create()),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(await fs.fileExists(leftover)).toBe(true);
    expect(fs.deletedDirectories).not.toContain(join(CODEX_CACHE_ROOT, MARKETPLACE));
    expect(logger.warnMessages.some((m) => m.includes("still holds"))).toBe(true);
  });
});
