import { describe, expect, it, vi } from "vitest";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  SYNTHETIC_NATIVE_SETTINGS,
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import {
  freshHostProof,
  manifestWithTool,
  marketplace,
  PROJECT_ROOT,
  seededBuiltCatalog,
} from "../testing/settings-scope.builder.js";

describe("settings synchronization under the machine ownership lock", () => {
  async function fixture() {
    const projectRepo = manifestWithTool(SYNTHETIC_NATIVE_TOOL);
    const machineRepo = manifestWithTool(SYNTHETIC_NATIVE_TOOL);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplace());
    const fs = seededBuiltCatalog(SYNTHETIC_NATIVE_TOOL);
    const activator = new FakeHostActions({ available: true });
    const proof = freshHostProof(SYNTHETIC_NATIVE_TOOL, activator);
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
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo: projectRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: proof.plugins,
      userManifestRepo: {
        path: machineRepo.path,
        load: () => machineRepo.load(),
        save: (manifest) => machineRepo.save(manifest),
        loadRecords: () => machineRepo.loadRecords(),
        saveRecords: (records) => machineRepo.saveRecords(records),
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
      expect(f.activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_NATIVE_TOOL}`]);
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
    expect(f.activator.addedMarketplaces).toEqual([`/built/${SYNTHETIC_NATIVE_TOOL}`]);
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
    expect(f.fs.getFile(`${PROJECT_ROOT}/${SYNTHETIC_NATIVE_SETTINGS}`)).toBeUndefined();
  });
});
