import { describe, expect, it } from "vitest";
import { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
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
  PROJECT_ROOT,
} from "../testing/marketplace-sync-settings-migration.builder.js";

import {
  OLD_CACHE_DIR,
  OLD_CACHE_FILE,
  projectWithMigratableEntry,
} from "../testing/stale-cache-purge.builder.js";

describe("SyncSettings - purging this project's own pre-migration cache", () => {
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
    const activator = new FakeHostActions({ available: true });
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
    expect(logger.warnMessages.some((w) => w.includes("pre-migration framework cache kept"))).toBe(
      true
    );
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
    expect(logger.warnMessages.some((w) => w.includes("pre-migration framework cache kept"))).toBe(
      true
    );
  });

  it("leaves the stale built tree in place when this run reports an error", async () => {
    const registry = projectWithMigratableEntry();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    const activator = new FakeHostActions({
      available: true,
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
    const activator = new FakeHostActions({ available: true });
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
});
