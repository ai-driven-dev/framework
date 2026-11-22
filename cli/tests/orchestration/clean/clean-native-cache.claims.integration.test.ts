import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  buildUseCase,
  CODEX_CACHE_ROOT,
  EXISTING_DIRECTORIES,
  LockAwareActivator,
  LockTrackingManifestRepository,
  MARKETPLACE,
  PROJECT_ROOT,
  REF,
  RecordingFileAdapter,
  seedAiddMarketplaceRegistry,
  seedManifest,
} from "../testing/clean-native-cache.builder.js";
import { HOST, hostCatalog } from "../testing/synthetic-hosts.builder.js";

describe("clean purges a host's own plugin cache: claims", () => {
  it("project A clean keeps a non-framework Codex catalogue cache and B's exact native claim", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CODEX_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    fs.setFile(cacheEntry, "B still uses these bytes");
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/some/built/path" },
        scope: "user",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const machine = Manifest.create();
    machine.addTool(HOST.codex, "1.0.0", []);
    machine.setNativeRegistrations(HOST.codex, {
      binary: HOST.codex,
      marketplaces: [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      manifest: seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger,
      aiddMarketplaceRegistry: registry,
      userManifestRepo: userRepo,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(fs.getFile(cacheEntry)).toBe("B still uses these bytes");
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(userRepo.getCurrent()?.getNativeRegistrations(HOST.codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/project-b"] },
    ]);
    expect(logger.warnMessages.join("\n")).toContain("Still needed by /project-b");
  });
  it("removes a project-labelled Codex catalogue when machine refs belong only to another host catalogue", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/some/built/path" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const machine = Manifest.create();
    machine.addTool(HOST.codex, "1.0.0", []);
    machine.setNativeRegistrations(HOST.codex, {
      binary: HOST.codex,
      marketplaces: [{ alias: "other-alias", hostName: "other-catalog" }],
      pluginRefs: ["other-plugin@other-catalog"],
      pluginClaims: [{ ref: "other-plugin@other-catalog", dependents: ["/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeHostActions({ available: true });
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs: new RecordingFileAdapter({}, EXISTING_DIRECTORIES),
      manifest: seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: registry,
      userManifestRepo: userRepo,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
    expect(userRepo.getCurrent()?.getNativeRegistrations(HOST.codex)?.pluginClaims).toEqual([
      { ref: "other-plugin@other-catalog", dependents: ["/project-b"] },
    ]);
  });
  it("holds the machine lock through native catalogue removal after checking its claims", async () => {
    const project = Manifest.create();
    project.addTool(HOST.codex, "1.0.0", []);
    project.setNativeRegistrations(HOST.codex, {
      binary: HOST.codex,
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: MARKETPLACE,
          provenance: {
            kind: "effective-list",
            root: "/some/built/path",
            sourceType: "local",
            source: "/some/built/path",
          },
        },
      ],
      pluginRefs: [],
    });
    const machine = Manifest.create();
    machine.addTool(HOST.codex, "1.0.0", []);
    const userRepo = new LockTrackingManifestRepository(machine);
    const activator = new LockAwareActivator(userRepo);
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs: new RecordingFileAdapter({}, EXISTING_DIRECTORIES),
      manifest: project,
      activator,
      binary: HOST.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: userRepo,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
    expect(activator.removalsUnderLock).toEqual([true]);
    expect(userRepo.lockCalls).toBe(1);
    expect(userRepo.locked).toBe(false);
  });
  it("leaves a project-labelled machine-global catalogue when no user manifest can prove it unshared", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/some/built/path" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const emptyCache = join(CODEX_CACHE_ROOT, MARKETPLACE);
    const fs = new RecordingFileAdapter({}, [...EXISTING_DIRECTORIES, emptyCache]);
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      manifest: seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger,
      aiddMarketplaceRegistry: registry,
      userManifestRepo: new InMemoryManifestRepository(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.deletedDirectories).not.toContain(emptyCache);
    expect(logger.warnMessages.join("\n")).toContain(
      "no user manifest can prove no other project still uses it"
    );

    const noRepoActivator = new FakeHostActions({ available: true });
    const noRepoLogger = new CapturingLogger();
    const noRepoFs = new RecordingFileAdapter({}, [...EXISTING_DIRECTORIES, emptyCache]);
    const noRepoUseCase = buildUseCase({
      tools: hostCatalog(),
      fs: noRepoFs,
      manifest: seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator: noRepoActivator,
      binary: HOST.codex,
      logger: noRepoLogger,
      aiddMarketplaceRegistry: registry,
    });
    await noRepoUseCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(noRepoActivator.removedMarketplaces).toEqual([]);
    expect(noRepoFs.deletedDirectories).not.toContain(emptyCache);
    expect(noRepoLogger.warnMessages.join("\n")).toContain(
      "no user manifest can prove no other project still uses it"
    );
  });
  it("keeps a project-labelled framework catalogue when B still has an exact native machine claim", async () => {
    const framework = "aidd-framework";
    const ref = `plugin-a@${framework}`;
    const project = seedManifest(HOST.codex, framework, framework);
    const projectRegistrations = project.getNativeRegistrations(HOST.codex);
    if (projectRegistrations === undefined) throw new Error("fixture missing project native state");
    project.setNativeRegistrations(HOST.codex, { ...projectRegistrations, pluginRefs: [ref] });
    const machine = Manifest.create();
    machine.addTool(HOST.codex, "1.0.0", []);
    machine.setNativeRegistrations(HOST.codex, {
      binary: HOST.codex,
      marketplaces: [{ alias: framework, hostName: framework }],
      pluginRefs: [ref],
      pluginClaims: [{ ref, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeHostActions({ available: true });
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs: new RecordingFileAdapter({}, EXISTING_DIRECTORIES),
      manifest: project,
      activator,
      binary: HOST.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(framework),
      userManifestRepo: userRepo,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(userRepo.getCurrent()?.getNativeRegistrations(HOST.codex)?.pluginClaims).toEqual([
      { ref, dependents: ["/project-b"] },
    ]);
  });
  it("project A clean never unregisters a project-labelled Codex catalogue still carrying B's machine ref", async () => {
    const fs = new RecordingFileAdapter({}, EXISTING_DIRECTORIES);
    const cacheEntry = join(CODEX_CACHE_ROOT, MARKETPLACE, "plugin-a", "1.0.0", "plugin.json");
    fs.setFile(cacheEntry, "B still uses these bytes");
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE,
        source: { kind: "local", path: "/some/built/path" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const machine = Manifest.create();
    machine.addTool(HOST.codex, "1.0.0", []);
    machine.setNativeRegistrations(HOST.codex, {
      binary: HOST.codex,
      marketplaces: [],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      manifest: seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger,
      aiddMarketplaceRegistry: registry,
      userManifestRepo: userRepo,
    });
    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(cacheEntry)).toBe("B still uses these bytes");
    expect(userRepo.getCurrent()?.getNativeRegistrations(HOST.codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/project-b"] },
    ]);
    expect(logger.warnMessages.join("\n")).toContain("Still needed by /project-b");
  });
  it("does not purge B's empty Codex cache shell when a machine claim blocked host unregister", async () => {
    const emptyCache = join(CODEX_CACHE_ROOT, MARKETPLACE);
    const fs = new RecordingFileAdapter({}, [...EXISTING_DIRECTORIES, emptyCache]);
    const machine = Manifest.create();
    machine.addTool(HOST.codex, "1.0.0", []);
    machine.setNativeRegistrations(HOST.codex, {
      binary: HOST.codex,
      marketplaces: [],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT, "/project-b"] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const activator = new FakeHostActions({ available: true });
    const useCase = buildUseCase({
      tools: hostCatalog(),
      fs,
      manifest: seedManifest(HOST.codex, MARKETPLACE, MARKETPLACE),
      activator,
      binary: HOST.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedAiddMarketplaceRegistry(MARKETPLACE),
      userManifestRepo: userRepo,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.deletedDirectories).not.toContain(emptyCache);
    expect(userRepo.getCurrent()?.getNativeRegistrations(HOST.codex)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/project-b"] },
    ]);
  });
});
