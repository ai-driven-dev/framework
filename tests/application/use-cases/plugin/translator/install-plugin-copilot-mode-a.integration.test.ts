import "../../../../../src/domain/tools/ai/copilot.js";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/application/use-cases/marketplace/marketplace-sync-settings-use-case.js";
import { ModeAMarketplaceTranslator } from "../../../../../src/application/use-cases/plugin/translator/mode-a-marketplace-translator.js";
import { Manifest } from "../../../../../src/domain/models/manifest.js";
import { Marketplace } from "../../../../../src/domain/models/marketplace.js";
import { PluginDistribution } from "../../../../../src/domain/models/plugin-distribution.js";
import { PluginCatalogRepositoryAdapter } from "../../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_NAME = "aidd-framework";

function buildDist(name = "aidd-context"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: "claude",
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

describe("install copilot plugin via Mode A (integration)", () => {
  it("writes extraKnownMarketplaces in .github/copilot/settings.json after sync", async () => {
    const fs = new InMemoryFileAdapter();
    const hasher = new DeterministicHasher();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    const catalog = new PluginCatalogRepositoryAdapter(fs);
    const manifest = Manifest.create();
    manifest.addTool("copilot", "test", []);

    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "copilot",
      { kind: "github", repo: "ai-driven-dev/framework" },
      PROJECT_ROOT,
      manifest,
      MARKETPLACE_NAME,
      "docs"
    );
    await manifestRepo.save(manifest);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: MARKETPLACE_NAME,
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );

    const useCase = new MarketplaceSyncSettingsUseCase(fs, manifestRepo, registry, catalog, hasher);
    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.updatedTools).toContain("copilot");
    const settingsPath = resolve(PROJECT_ROOT, ".github/copilot/settings.json");
    const settings = JSON.parse(await fs.readFile(settingsPath)) as Record<string, unknown>;
    expect(settings.extraKnownMarketplaces).toBeDefined();
    expect((settings.extraKnownMarketplaces as Record<string, unknown>)[MARKETPLACE_NAME]).toEqual({
      source: { source: "github", repo: "ai-driven-dev/framework" },
    });
    expect(settings.enabledPlugins).toBeDefined();
  });
});
