// Codex enables plugins through its own CLI, which writes the user-global
// `~/.codex/config.toml` and plugin cache, so a project-local settings file is inert.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { SyncSettings } from "../../../../../src/orchestration/sync/sync-settings.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../../src/shared/domain/source.js";
import { HasherAdapter } from "../../../../../src/shared/infrastructure/hasher-adapter.js";
import { marketplaceSync } from "../../../../helpers/marketplace-sync.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { FakeHostMarketplaceSources } from "../../testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_NAME = "aidd-framework";

function syncWithProvenFreshHost(
  fs: InMemoryFileAdapter,
  manifestRepo: InMemoryManifestRepository,
  registry: FakeMarketplaceRegistry,
  hasher: HasherAdapter,
  logger: CapturingLogger,
  activator: FakeHostActions
): SyncSettings {
  return marketplaceSync({
    fs,
    manifestRepo,
    marketplaceRegistry: registry,
    hasher,
    logger,
    activators: new Map([[TOOL.codex, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    hostPluginRegistries: new Map([
      [TOOL.codex, new FakeHostPluginRegistry({ location: "fake codex", refs: new Map() })],
    ]),
    nativeSources: new Map([
      [
        TOOL.codex,
        new FakeHostMarketplaceSources(
          activator,
          "effective-list",
          (path) => (path === "/built/codex" ? MARKETPLACE_NAME : undefined),
          new Map()
        ),
      ],
    ]),
  });
}

/** A readable catalog at the path `fakeEnsureBuiltMarketplace()` resolves "codex" to, at its
 * own `distributionProbes.marketplace` relative path: a real build always leaves one there, and
 * an unreadable catalog is now `UnreadableBuiltCatalogError` rather than a fall back. */
async function seedBuiltCatalog(fs: InMemoryFileAdapter, name = MARKETPLACE_NAME): Promise<void> {
  await fs.writeFile(
    "/built/codex/.agents/plugins/marketplace.json",
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

async function seedCodexPlugin(
  manifestRepo: InMemoryManifestRepository,
  registry: FakeMarketplaceRegistry,
  source: PluginSource = { kind: "local", path: "/marketplace-source" }
): Promise<void> {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.codex, "test", []);
  await new ModeAMarketplaceTranslator().addPlugin(
    buildDist(),
    registeredTools().aiProfile(TOOL.codex),
    { kind: "local", path: "/plugin-source" },
    PROJECT_ROOT,
    manifest,
    MARKETPLACE_NAME
  );
  await manifestRepo.save(manifest);
  registry.seed(PROJECT_ROOT, {
    name: MARKETPLACE_NAME,
    source,
    scope: "project",
  });
}

async function seedTwoCodexPlugins(
  manifestRepo: InMemoryManifestRepository,
  registry: FakeMarketplaceRegistry
): Promise<void> {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.codex, "test", []);
  const translator = new ModeAMarketplaceTranslator();
  for (const name of ["aidd-context", "aidd-vcs"]) {
    await translator.addPlugin(
      buildDist(name),
      registeredTools().aiProfile(TOOL.codex),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      MARKETPLACE_NAME
    );
  }
  await manifestRepo.save(manifest);
  registry.seed(PROJECT_ROOT, {
    name: MARKETPLACE_NAME,
    source: { kind: "local", path: "/marketplace-source" },
    scope: "project",
  });
}

describe("install codex plugin via Mode A (integration)", () => {
  it("drives the codex CLI and writes no project-local config.json", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const hasher = new HasherAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    const activator = new FakeHostActions({ available: true });
    await seedCodexPlugin(manifestRepo, registry);

    const useCase = syncWithProvenFreshHost(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      activator
    );
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    // Registers the BUILT (transformed) tree, not the raw source. A fresh add
    // succeeds outright — no pre-emptive remove on a clean install.
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(activator.upgradeCount).toBe(0);
    expect(activator.enabledPlugins).toEqual([`aidd-context@${MARKETPLACE_NAME}`]);
    expect(await fs.fileExists(resolve(PROJECT_ROOT, ".codex/config.json"))).toBe(false);
  });

  it("builds a github marketplace locally and registers the built tree", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    const activator = new FakeHostActions({ available: true });
    await seedCodexPlugin(manifestRepo, registry, {
      kind: "github",
      repo: "ai-driven-dev/framework",
    });

    const useCase = syncWithProvenFreshHost(
      fs,
      manifestRepo,
      registry,
      new HasherAdapter(),
      new CapturingLogger(),
      activator
    );
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.addedMarketplaces).toEqual(["/built/codex"]);
    expect(activator.enabledPlugins).toEqual([`aidd-context@${MARKETPLACE_NAME}`]);
  });

  it("enables the remaining plugins when one plugin fails (per-plugin best-effort)", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    const logger = new CapturingLogger();
    const activator = new FakeHostActions({
      available: true,
      failOnPlugins: [`aidd-context@${MARKETPLACE_NAME}`],
    });
    await seedTwoCodexPlugins(manifestRepo, registry);

    const useCase = syncWithProvenFreshHost(
      fs,
      manifestRepo,
      registry,
      new HasherAdapter(),
      logger,
      activator
    );
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.enabledPlugins).toEqual([`aidd-vcs@${MARKETPLACE_NAME}`]);
    expect(logger.warnMessages.some((m) => m.includes("aidd-context@aidd-framework"))).toBe(true);
  });

  it("skips activation when the codex CLI is unavailable", async () => {
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    const activator = new FakeHostActions({ available: false });
    await seedCodexPlugin(manifestRepo, registry);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      hasher: new HasherAdapter(),
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.codex, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
  });
});
