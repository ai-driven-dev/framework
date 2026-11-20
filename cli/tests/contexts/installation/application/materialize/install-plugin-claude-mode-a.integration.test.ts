import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { SyncSettings } from "../../../../../src/orchestration/sync/sync-settings.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { marketplaceSync } from "../../../../helpers/marketplace-sync.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { FakeHostMarketplaceSources } from "../../testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";
import { InMemoryManifestRepository } from "../../testing/in-memory-manifest-repository.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_NAME = "aidd-framework";

function syncWithProvenFreshHost(
  fs: InMemoryFileAdapter,
  manifestRepo: InMemoryManifestRepository,
  registry: FakeMarketplaceRegistry,
  activator: FakeHostActions
): SyncSettings {
  return marketplaceSync({
    fs,
    manifestRepo,
    marketplaceRegistry: registry,
    logger: new CapturingLogger(),
    activators: new Map([[TOOL.claude, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    hostPluginRegistries: new Map([
      [TOOL.claude, new FakeHostPluginRegistry({ location: "fake claude", refs: new Map() })],
    ]),
    nativeSources: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          (path) => (path === "/built/claude" ? MARKETPLACE_NAME : undefined),
          new Map()
        ),
      ],
    ]),
  });
}

/** A readable catalog at the path the default `fakeEnsureBuiltMarketplace()` resolves
 * "claude" to — a real build always leaves one there, and an unreadable one now fails hard. */
async function seedBuiltCatalog(fs: InMemoryFileAdapter, name = MARKETPLACE_NAME): Promise<void> {
  await fs.writeFile(
    "/built/claude/.claude-plugin/marketplace.json",
    JSON.stringify({ name, version: "1.0.0", plugins: [] })
  );
}

function buildDist(name = "aidd-context"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [{ relativePath: "commands/hello.md", content: "# Hello" }],
    components: {
      commands: [{ relativePath: "commands/hello.md", content: "# Hello" }],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

describe("install claude plugin via Mode A (integration)", () => {
  it("leaves the registration to claude and keeps only what it owns", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    // Claude drives its own registration; it does not enable plugins that way.
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);

    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      registeredTools().aiProfile(TOOL.claude),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      MARKETPLACE_NAME
    );
    await manifestRepo.save(manifest);
    registry.seed(PROJECT_ROOT, {
      name: MARKETPLACE_NAME,
      source: { kind: "local", path: "/marketplace-source" },
      scope: "project",
    });

    const useCase = syncWithProvenFreshHost(fs, manifestRepo, registry, activator);
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const shared = JSON.parse(
      await fs.readFile(resolve(PROJECT_ROOT, ".claude/settings.json"))
    ) as Record<string, unknown>;

    // Claude registers its own marketplaces through its own command, so this CLI
    // writes no registration anywhere — not in the shared file, not beside it.
    expect(shared.extraKnownMarketplaces).toBeUndefined();
    expect(await fs.fileExists(resolve(PROJECT_ROOT, ".claude/settings.local.json"))).toBe(false);
    expect(activator.addedMarketplaces).toEqual(["/built/claude"]);

    // Enabled plugins stay here: `claude plugin install --scope project` writes this
    // very object, so driving it would be a second way of doing the same thing.
    expect(
      (shared.enabledPlugins as Record<string, boolean>)[`aidd-context@${MARKETPLACE_NAME}`]
    ).toBe(true);
    expect(activator.enabledPlugins).toEqual([]);
  });

  it("takes a registration left in the shared file by an older install out of it", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    // Claude drives its own registration; it does not enable plugins that way.
    const activator = new FakeHostActions({ available: true, enablesPlugins: false });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);

    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      registeredTools().aiProfile(TOOL.claude),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      MARKETPLACE_NAME
    );
    await manifestRepo.save(manifest);
    registry.seed(PROJECT_ROOT, {
      name: MARKETPLACE_NAME,
      source: { kind: "local", path: "/marketplace-source" },
      scope: "project",
    });

    const useCase = syncWithProvenFreshHost(fs, manifestRepo, registry, activator);

    // What a project installed before the split looks like: the registration sitting in
    // the committed file, naming a path that belongs to whoever ran the install.
    await fs.writeFile(
      resolve(PROJECT_ROOT, ".claude/settings.json"),
      JSON.stringify({
        extraKnownMarketplaces: {
          [MARKETPLACE_NAME]: { source: { source: "directory", path: "/someone/elses/machine" } },
        },
      })
    );

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    const shared = JSON.parse(
      await fs.readFile(resolve(PROJECT_ROOT, ".claude/settings.json"))
    ) as Record<string, unknown>;

    expect(shared.extraKnownMarketplaces).toBeUndefined();
    expect(activator.addedMarketplaces).toContain("/built/claude");
    // Both branches wrote the shared file in this one call — the eviction, then the enabled-
    // plugins merge; the plugin landing proves the second did not carry the evicted key back.
    expect(
      (shared.enabledPlugins as Record<string, boolean>)[`aidd-context@${MARKETPLACE_NAME}`]
    ).toBe(true);
  });
});
