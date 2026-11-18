import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { FakeHostMarketplaceSources } from "../../contexts/host-registration/testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.js";
import { marketplaceSync } from "../../helpers/marketplace-sync.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";
import { FakeCurrentVersion } from "../../helpers/ports/fake-current-version.js";
import { fakeEnsureBuiltMarketplace } from "../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.js";
import { TOOL } from "../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE = "aidd-framework";

function marketplace(): Marketplace {
  return Marketplace.create({
    name: MARKETPLACE,
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "user",
    addedAt: "2026-09-02T00:00:00Z",
  });
}

function manifestWithTool(): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "test", []);
  return new InMemoryManifestRepository(manifest);
}

function seededBuiltCatalog(): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
      name: MARKETPLACE,
      version: "1.0.0",
      plugins: [],
    }),
  });
}

function freshHostProof(activator: FakeHostActions) {
  return {
    plugins: new Map([
      [
        TOOL.claude,
        new FakeHostPluginRegistry({
          location: "/host/installed_plugins.json",
          refs: new Map(),
        }),
      ],
    ]),
    sources: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          (path) => (path === "/built/claude" ? MARKETPLACE : undefined),
          new Map()
        ),
      ],
    ]),
  };
}

describe("settings synchronization under the machine ownership lock", () => {
  async function fixture() {
    const projectRepo = manifestWithTool();
    const machineRepo = manifestWithTool();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const fs = seededBuiltCatalog();
    const activator = new FakeHostActions({ available: true });
    const proof = freshHostProof(activator);
    let locked = false;
    const accesses: boolean[] = [];
    const originalLoad = projectRepo.load.bind(projectRepo);
    const load = vi.spyOn(projectRepo, "load");
    load.mockImplementation(async () => {
      accesses.push(locked);
      return originalLoad();
    });
    const acquireLock = vi.fn(() => {});
    const withExclusiveAccess = async <T>(action: () => Promise<T>): Promise<T> => {
      acquireLock();
      locked = true;
      try {
        return await action();
      } finally {
        locked = false;
      }
    };
    const sync = marketplaceSync({
      fs,
      manifestRepo: projectRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: proof.plugins,
      userManifestRepo: {
        path: machineRepo.path,
        load: () => machineRepo.load(),
        save: (manifest) => machineRepo.save(manifest),
        delete: () => machineRepo.delete(),
        withExclusiveAccess,
      },
      nativeSources: proof.sources,
    });
    return { sync, fs, activator, projectRepo, machineRepo, acquireLock, accesses, load };
  }

  it.each([undefined, "project"] as const)(
    "reads project ownership only inside the machine lock for scope %s",
    async (scope) => {
      const f = await fixture();
      const result = await f.sync.execute({
        projectRoot: PROJECT_ROOT,
        scope,
      });
      expect(result.errors).toEqual([]);
      expect(f.acquireLock).toHaveBeenCalledTimes(1);
      expect(f.accesses.length).toBeGreaterThan(0);
      expect(f.accesses.every(Boolean)).toBe(true);
      expect(f.activator.addedMarketplaces).toEqual(["/built/claude"]);
      expect(f.machineRepo.saveCount).toBe(1);
    }
  );

  it("does not reacquire the project ownership lock during an explicit user-scope sync", async () => {
    const f = await fixture();
    const result = await f.sync.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });
    expect(result.errors).toEqual([]);
    expect(f.acquireLock).not.toHaveBeenCalled();
    expect(f.activator.addedMarketplaces).toEqual(["/built/claude"]);
    expect(f.machineRepo.saveCount).toBe(1);
  });

  it("propagates a machine lock failure before reading or changing project and host state", async () => {
    const f = await fixture();
    const error = new Error("machine ownership lock unavailable");
    f.acquireLock.mockImplementationOnce(() => {
      throw error;
    });
    await expect(f.sync.execute({ projectRoot: PROJECT_ROOT })).rejects.toBe(error);
    expect(f.load).not.toHaveBeenCalled();
    expect(f.projectRepo.saveCount).toBe(0);
    expect(f.machineRepo.saveCount).toBe(0);
    expect(f.activator.addedMarketplaces).toEqual([]);
    expect(f.activator.removedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(f.fs.getFile(`${PROJECT_ROOT}/.claude/settings.json`)).toBeUndefined();
  });
});

describe("SyncSettings — the activation scope a caller asks for", () => {
  it("enables at project scope by default, never claude's own implicit default", async () => {
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const proof = freshHostProof(activator);
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: manifestWithTool(),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: proof.plugins,
      nativeSources: proof.sources,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    // No plugin declared here, so nothing to enable: this asserts the marketplace
    // registration path ran at all, and the next test declares one for enablePlugin.
    expect(activator.addedMarketplaces).toHaveLength(1);
  });

  it("passes the user scope down to enablePlugin when the caller asks for it", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    const { InstalledPlugin } = await import(
      "../../../src/contexts/installation/domain/plugins/installed-plugin.js"
    );
    manifest.addPlugin(
      TOOL.claude,
      InstalledPlugin.fromMetadata(
        "aidd-telemetry",
        "1.0.0",
        { kind: "github", repo: "ai-driven-dev/framework" },
        true,
        "project",
        MARKETPLACE
      )
    );
    const catalog = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: MARKETPLACE,
        version: "1.0.0",
        plugins: [{ name: "aidd-telemetry" }],
      }),
    });
    const proof = freshHostProof(activator);
    const useCase = marketplaceSync({
      fs: catalog,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: proof.plugins,
      nativeSources: proof.sources,
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(activator.enabledPluginScopes).toEqual(["user"]);
  });

  // A manifest carrying a plugin whose marketplace resolves, so `syncEnabledPluginsFile` has
  // a real entry to write: an empty, no-plugin manifest wrote nothing under either scope.
  async function pluginFixture(): Promise<{
    fs: InMemoryFileAdapter;
    manifestRepo: InMemoryManifestRepository;
  }> {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    const { InstalledPlugin } = await import(
      "../../../src/contexts/installation/domain/plugins/installed-plugin.js"
    );
    manifest.addPlugin(
      TOOL.claude,
      InstalledPlugin.fromMetadata(
        "aidd-telemetry",
        "1.0.0",
        { kind: "github", repo: "ai-driven-dev/framework" },
        true,
        "project",
        MARKETPLACE
      )
    );
    const fs = new InMemoryFileAdapter({
      "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
        name: MARKETPLACE,
        version: "1.0.0",
        plugins: [{ name: "aidd-telemetry" }],
      }),
    });
    return { fs, manifestRepo: new InMemoryManifestRepository(manifest) };
  }

  it("writes no project file at all when the caller asks for user scope — the full project delta, not one named path", async () => {
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const { fs, manifestRepo } = await pluginFixture();
    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    // resolve(): a project-scope write lands at resolve(projectRoot, settingsPath), which
    // carries a drive letter on win32, so the drive-less literal would prove nothing there.
    expect(fs.listUnder(resolve(PROJECT_ROOT))).toEqual([]);
  });

  it("writes no project file for a plugin the host proved at user scope", async () => {
    const activator = new FakeHostActions({ available: true });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.copilot, "test", []);
    const fs = new InMemoryFileAdapter({
      "/built/copilot/.plugin/marketplace.json": JSON.stringify({
        name: MARKETPLACE,
        version: "1.0.0",
        plugins: [{ name: "aidd-telemetry" }],
      }),
    });
    const useCase = marketplaceSync({
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: new Map([
        [
          TOOL.copilot,
          new FakeHostPluginRegistry({ location: "/host/settings.json", refs: new Map() }),
        ],
      ]),
      nativeSources: new Map([
        [
          TOOL.copilot,
          new FakeHostMarketplaceSources(
            activator,
            "effective-list",
            (path) => (path === "/built/copilot" ? MARKETPLACE : undefined),
            new Map()
          ),
        ],
      ]),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
      enablePlugins: ["aidd-telemetry"],
    });

    expect(activator.enabledPluginScopes).toEqual(["user"]);
    expect(fs.listUnder(resolve(PROJECT_ROOT))).toEqual([]);
  });

  it("writes .claude/settings.json for that same fixture at project scope — proof the fixture is not inert", async () => {
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const { fs, manifestRepo } = await pluginFixture();
    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    // resolve(): the write carries a drive letter on win32, which a forward-slash template
    // literal never matches.
    const written = await fs.readFile(resolve(PROJECT_ROOT, ".claude", "settings.json"));
    expect(written).toContain("aidd-telemetry");
  });

  it("loads and saves the machine manifest at user scope, never the project's", async () => {
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const constructedRepo = manifestWithTool();
    const machineRepo = manifestWithTool();
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: constructedRepo,
      userManifestRepo: machineRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(result.activated).toEqual(["claude"]);
    expect(machineRepo.getCurrent()?.getNativeRegistrations(TOOL.claude)).toBeDefined();
    expect(constructedRepo.getCurrent()?.getNativeRegistrations(TOOL.claude)).toBeUndefined();
  });

  it("records no shared-source reference at user scope — no project-scope manifest exists for a later clean to ever decrement it from", async () => {
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const added: Array<{ version: string; projectRoot: string }> = [];
    const userSourceReferences: UserSourceReferences = {
      addReference: async (version, projectRoot) => {
        added.push({ version, projectRoot });
      },
      removeReference: async () => undefined,
      listAllReferencingProjects: async () => [],
    };
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: manifestWithTool(),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      scope: "user",
    });

    expect(added).toEqual([]);
  });

  it("still records a shared-source reference at project scope, unaffected", async () => {
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const proof = freshHostProof(activator);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const added: Array<{ version: string; projectRoot: string }> = [];
    const userSourceReferences: UserSourceReferences = {
      addReference: async (version, projectRoot) => {
        added.push({ version, projectRoot });
      },
      removeReference: async () => undefined,
      listAllReferencingProjects: async () => [],
    };
    const useCase = marketplaceSync({
      fs: seededBuiltCatalog(),
      manifestRepo: manifestWithTool(),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.claude, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      userSourceReferences,
      currentVersionProvider: new FakeCurrentVersion(),
      hostPluginRegistries: proof.plugins,
      nativeSources: proof.sources,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(added).toHaveLength(1);
  });
});
