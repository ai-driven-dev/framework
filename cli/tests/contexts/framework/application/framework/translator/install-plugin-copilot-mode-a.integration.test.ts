import "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { ModeAMarketplaceTranslator } from "../../../../../../src/contexts/framework/application/framework/translator/mode-a-marketplace-translator.js";
import { Manifest } from "../../../../../../src/contexts/framework/domain/manifest.js";
import { PluginDistribution } from "../../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { CapturingLogger } from "../../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostPluginRegistryReader } from "../../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_NAME = "aidd-framework";

function ownedMachineCatalog(): InMemoryManifestRepository {
  const machine = Manifest.create();
  machine.addTool("copilot", "test", []);
  machine.setNativeRegistrations("copilot", {
    binary: "copilot",
    marketplaces: [{ alias: MARKETPLACE_NAME, hostName: MARKETPLACE_NAME }],
    pluginRefs: [],
    pluginClaims: [],
  });
  return new InMemoryManifestRepository(machine);
}

function readableHostPlugins() {
  return new Map([
    [
      "copilot" as const,
      new FakeHostPluginRegistryReader({
        location: "/home/.copilot/plugins",
        refs: new Map(),
      }),
    ],
  ]);
}

/** A real build always leaves a catalog at copilot's own `distributionProbes.marketplace`
 * path, and an unreadable one is a hard failure, so the fixture must leave one too. */
async function seedBuiltCatalog(fs: InMemoryFileAdapter, name = MARKETPLACE_NAME): Promise<void> {
  await fs.writeFile(
    "/built/copilot/.plugin/marketplace.json",
    JSON.stringify({ name, version: "1.0.0", plugins: [] })
  );
}

async function seedCopilotPlugin(
  manifestRepo: InMemoryManifestRepository,
  registry: InMemoryMarketplaceRegistry
): Promise<void> {
  const manifest = Manifest.create();
  manifest.addTool("copilot", "test", []);
  await new ModeAMarketplaceTranslator().addPlugin(
    buildDist(),
    "copilot",
    { kind: "github", repo: "ai-driven-dev/framework" },
    PROJECT_ROOT,
    manifest,
    MARKETPLACE_NAME
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
}

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
  it("does not auto-install an unproven plugin or rewrite a foreign marketplace overlay", async () => {
    const fs = new InMemoryFileAdapter();
    const hasher = new DeterministicHasher();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    await seedCopilotPlugin(manifestRepo, registry);
    const settingsPath = resolve(PROJECT_ROOT, ".github/copilot/settings.json");
    const foreignSettings = JSON.stringify({
      enabledPlugins: { "foreign@foreign-catalog": true },
      extraKnownMarketplaces: { "foreign-catalog": { source: "github" } },
    });
    await fs.writeFile(settingsPath, foreignSettings);

    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map(),
      fakeEnsureBuiltMarketplace()
    );
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(await fs.readFile(settingsPath)).toBe(foreignSettings);
  });

  it("projects only a plugin ref whose marketplace source a future host reader verifies", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    const activator = new FakeNativePluginActivator({ available: true });
    await seedCopilotPlugin(manifestRepo, registry);

    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["copilot", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      undefined,
      new Map([
        [
          "copilot",
          new FakeNativeMarketplaceSourceReader(
            activator,
            "effective-list",
            (path) => (path === "/built/copilot" ? MARKETPLACE_NAME : undefined),
            new Map()
          ),
        ],
      ])
    );
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual(["/built/copilot"]);
    expect(activator.enabledPlugins).toEqual([`aidd-context@${MARKETPLACE_NAME}`]);
    expect(await fs.fileExists(resolve(PROJECT_ROOT, ".github/copilot/settings.json"))).toBe(true);
  });

  it("refuses force takeover of a claimed Copilot name without host source proof", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    // A missing source does not by itself prove who owns the host registration.
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    await seedCopilotPlugin(manifestRepo, registry);

    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["copilot", activator]]),
      fakeEnsureBuiltMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      readableHostPlugins(),
      ownedMachineCatalog()
    );
    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.forcedRemovals).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings.join("\n")).toContain("host source unproven");
  });

  it("refuses force takeover of a dead name without a canonical owner", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    await seedCopilotPlugin(manifestRepo, registry);
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    const result = await new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([["copilot", activator]]),
      fakeEnsureBuiltMarketplace()
    ).execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.forcedRemovals).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings.join("\n")).toContain("host source unproven");
  });

  it("leaves a name alone while it still resolves, whoever holds it", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    // Held, and the source resolves: another project is alive behind it. Taking the
    // name would break that project, and both would then steal it back on every sync.
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "live",
    });
    const logger = new CapturingLogger();
    await seedCopilotPlugin(manifestRepo, registry);

    await new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      new DeterministicHasher(),
      logger,
      new Map([["copilot", activator]]),
      fakeEnsureBuiltMarketplace()
    ).execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(logger.warnMessages.some((m) => m.includes("host source unproven"))).toBe(true);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
  });

  it("says nothing about taking a name back when it cannot tell who holds it", async () => {
    const fs = new InMemoryFileAdapter();
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    // The tool offers no way to tell a dead registration from a live one, which must
    // read as "leave it alone" rather than as permission.
    const activator = new FakeNativePluginActivator({
      available: true,
      conflictOnAdd: true,
      registrationState: "unknown",
    });
    const logger = new CapturingLogger();
    await seedCopilotPlugin(manifestRepo, registry);

    const useCase = new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      new DeterministicHasher(),
      logger,
      new Map([["copilot", activator]]),
      fakeEnsureBuiltMarketplace()
    );
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(logger.warnMessages.some((m) => m.includes("no longer exists"))).toBe(false);
    expect(logger.warnMessages.some((m) => m.includes("host source unproven"))).toBe(true);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
  });
});
