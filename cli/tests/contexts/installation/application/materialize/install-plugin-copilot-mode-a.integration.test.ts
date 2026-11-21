import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { marketplaceSync } from "../../../../shared/testing/marketplace-sync.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceSources } from "../../testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_NAME = "aidd-framework";

function ownedMachineCatalog(): InMemoryManifestRepository {
  const machine = Manifest.create();
  machine.addTool(TOOL.copilot, "test", []);
  machine.setNativeRegistrations(TOOL.copilot, {
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
      TOOL.copilot,
      new FakeHostPluginRegistry({
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
  registry: FakeMarketplaceRegistry
): Promise<void> {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.copilot, "test", []);
  await new ModeAMarketplaceTranslator().addPlugin({
    dist: buildDist(),
    tool: registeredTools().aiProfile(TOOL.copilot),
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    projectRoot: PROJECT_ROOT,
    manifest,
    marketplace: MARKETPLACE_NAME,
  });
  await manifestRepo.save(manifest);
  registry.seed(PROJECT_ROOT, {
    name: MARKETPLACE_NAME,
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
  });
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

describe("install copilot plugin via Mode A (integration)", () => {
  it("does not auto-install an unproven plugin or rewrite a foreign marketplace overlay", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    await seedCopilotPlugin(manifestRepo, registry);
    const settingsPath = resolve(PROJECT_ROOT, ".github/copilot/settings.json");
    const foreignSettings = JSON.stringify({
      enabledPlugins: { "foreign@foreign-catalog": true },
      extraKnownMarketplaces: { "foreign-catalog": { source: "github" } },
    });
    await fs.writeFile(settingsPath, foreignSettings);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(await fs.readFile(settingsPath)).toBe(foreignSettings);
  });

  it("projects only a plugin ref whose marketplace source a future host reader verifies", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    const activator = new FakeHostActions({ available: true });
    await seedCopilotPlugin(manifestRepo, registry);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: readableHostPlugins(),
      nativeSources: new Map([
        [
          TOOL.copilot,
          new FakeHostMarketplaceSources(
            activator,
            "effective-list",
            (path) => (path === "/built/copilot" ? MARKETPLACE_NAME : undefined),
            new Map()
          ),
        ],
      ]),
    });
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual(["/built/copilot"]);
    expect(activator.enabledPlugins).toEqual([`aidd-context@${MARKETPLACE_NAME}`]);
    expect(await fs.fileExists(resolve(PROJECT_ROOT, ".github/copilot/settings.json"))).toBe(true);
  });

  it("refuses force takeover of a claimed Copilot name without host source proof", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    // A missing source does not by itself prove who owns the host registration.
    const activator = new FakeHostActions({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    await seedCopilotPlugin(manifestRepo, registry);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: readableHostPlugins(),
      userManifestRepo: ownedMachineCatalog(),
    });
    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.forcedRemovals).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings.join("\n")).toContain("host source unproven");
  });

  it("refuses force takeover of a dead name without a canonical owner", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    await seedCopilotPlugin(manifestRepo, registry);
    const activator = new FakeHostActions({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
    });
    const result = await marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    }).execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.forcedRemovals).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings.join("\n")).toContain("host source unproven");
  });

  it("leaves a name alone while it still resolves, whoever holds it", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    // Held, and the source resolves: another project is alive behind it. Taking the
    // name would break that project, and both would then steal it back on every sync.
    const activator = new FakeHostActions({
      available: true,
      conflictOnAdd: true,
      registrationState: "live",
    });
    const logger = new CapturingLogger();
    await seedCopilotPlugin(manifestRepo, registry);

    await marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger,
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    }).execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(logger.warnMessages.some((m) => m.includes("host source unproven"))).toBe(true);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
  });

  it("says nothing about taking a name back when it cannot tell who holds it", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    await seedBuiltCatalog(fs);
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new FakeMarketplaceRegistry();
    // The tool offers no way to tell a dead registration from a live one, which must
    // read as "leave it alone" rather than as permission.
    const activator = new FakeHostActions({
      available: true,
      conflictOnAdd: true,
      registrationState: "unknown",
    });
    const logger = new CapturingLogger();
    await seedCopilotPlugin(manifestRepo, registry);

    const useCase = marketplaceSync({
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger,
      activators: new Map([[TOOL.copilot, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
    });
    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(activator.removedMarketplaces).toEqual([]);
    expect(logger.warnMessages.some((m) => m.includes("no longer exists"))).toBe(false);
    expect(logger.warnMessages.some((m) => m.includes("host source unproven"))).toBe(true);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
  });
});
