import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { registerMarketplacePlugin } from "../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import {
  SYNTHETIC_LISTED_CATALOGUE,
  SYNTHETIC_LISTED_TOOL,
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { SYNTHETIC_IDE_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  distribution,
  freshClaudeSource,
  PROJECT_ROOT,
  readableClaudePluginRegistry,
  seededBuiltCatalog,
} from "../testing/sync-settings.builder.js";

/** `sync --tool <id>` must touch only that tool - otherwise a person fixing one tool's
 * registration would silently re-drive every other tool's CLI too. */
describe("toolIds narrows which tool's CLI is driven", () => {
  it("never calls the activator of a tool not named in toolIds", async () => {
    const fs = seededBuiltCatalog();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    const manifest = aManifest()
      .withTool(SYNTHETIC_NATIVE_TOOL, [], { version: "test" })
      .withTool(SYNTHETIC_LISTED_TOOL, [], { version: "test" })
      .build();
    await registerMarketplacePlugin({
      dist: distribution(SYNTHETIC_NATIVE_TOOL, "aidd-context"),
      tool: syntheticSyncCatalog().aiProfile(SYNTHETIC_NATIVE_TOOL),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: "aidd-framework",
    });
    await manifestRepo.save(manifest);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "aidd-framework",
        source: { kind: "local", path: "/source/aidd-framework" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const claudeActivator = new FakeHostActions({ available: true });
    const codexActivator = new FakeHostActions({ available: true });
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([
        [SYNTHETIC_NATIVE_TOOL, claudeActivator],
        [SYNTHETIC_LISTED_TOOL, codexActivator],
      ]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: readableClaudePluginRegistry(SYNTHETIC_NATIVE_TOOL),
      nativeSources: freshClaudeSource(SYNTHETIC_NATIVE_TOOL, claudeActivator),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      toolIds: [SYNTHETIC_NATIVE_TOOL],
    });

    expect(claudeActivator.addedMarketplaces).not.toEqual([]);
    expect(codexActivator.addedMarketplaces).toEqual([]);
    expect(result.activated).toEqual([SYNTHETIC_NATIVE_TOOL]);
    expect(result.failed, "no error was returned, so the run did not fail").toBe(false);
  });

  it("leaves the other tool's CLI alone even when that tool's own tree is ready to register", async () => {
    const fs = seededBuiltCatalog();
    fs.setFile(
      `/built/${SYNTHETIC_LISTED_TOOL}/${SYNTHETIC_LISTED_CATALOGUE}`,
      JSON.stringify({ name: "aidd-framework", version: "1.0.0", plugins: [] })
    );
    const manifest = aManifest()
      .withTool(SYNTHETIC_NATIVE_TOOL, [], { version: "test" })
      .withTool(SYNTHETIC_LISTED_TOOL, [], { version: "test" })
      .build();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "aidd-framework",
        source: { kind: "local", path: "/source/aidd-framework" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const claudeActivator = new FakeHostActions({ available: true });
    const codexActivator = new FakeHostActions({ available: true });
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([
        [SYNTHETIC_NATIVE_TOOL, claudeActivator],
        [SYNTHETIC_LISTED_TOOL, codexActivator],
      ]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: readableClaudePluginRegistry(SYNTHETIC_NATIVE_TOOL),
      nativeSources: freshClaudeSource(SYNTHETIC_NATIVE_TOOL, claudeActivator),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      toolIds: [SYNTHETIC_NATIVE_TOOL],
    });

    expect(claudeActivator.addedMarketplaces).toStrictEqual([`/built/${SYNTHETIC_NATIVE_TOOL}`]);
    expect(codexActivator.addedMarketplaces).toStrictEqual([]);
    expect(result).toStrictEqual({
      activated: [SYNTHETIC_NATIVE_TOOL],
      binaryMissing: [],
      warnings: [],
      errors: [],
      failed: false,
    });
  });
});

describe("a project whose manifest also lists a tool with no plugin system", () => {
  it("syncs the other tools and reports only the one whose CLI ran", async () => {
    const fs = seededBuiltCatalog();
    const manifest = aManifest()
      .withTool(SYNTHETIC_NATIVE_TOOL, [], { version: "test" })
      .withTool(SYNTHETIC_IDE_TOOL, [], { version: "test" })
      .build();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "aidd-framework",
        source: { kind: "local", path: "/source/aidd-framework" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const activator = new FakeHostActions({ available: true });
    const useCase = marketplaceSync({
      tools: syntheticSyncCatalog(),
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest),
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[SYNTHETIC_NATIVE_TOOL, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: readableClaudePluginRegistry(SYNTHETIC_NATIVE_TOOL),
      nativeSources: freshClaudeSource(SYNTHETIC_NATIVE_TOOL, activator),
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result).toStrictEqual({
      activated: [SYNTHETIC_NATIVE_TOOL],
      binaryMissing: [],
      warnings: [],
      errors: [],
      failed: false,
    });
  });
});
