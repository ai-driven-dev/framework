import { describe, expect, it } from "vitest";
import type { RegisterFrameworkMarketplaceCommand } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { fsAt } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  CLAUDE_BUILT_DIR,
  catalogFixture,
  manifestWithClaude,
  PROJECT_ROOT,
} from "../testing/marketplace-sync-settings-migration.builder.js";

import {
  OLD_CACHE_FILE,
  projectWithMigratableEntry,
  recordingRegister,
  registryWithSharedFramework,
  staleCacheAndCatalog,
} from "../testing/stale-cache-purge.builder.js";

describe("SyncSettings — when the stale cache is left alone", () => {
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
    expect((await registry.list(PROJECT_ROOT)).map((m) => m.name)).toStrictEqual(["other-plugins"]);
  });
});
