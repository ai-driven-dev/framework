/**
 * A narrowed run's outcome carries only the marketplace it touched, so replacing
 * `nativeRegistrations` wholesale would erase every other marketplace's record.
 */
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import type { EnsureBuiltMarketplace } from "../../../../../src/contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { FakeHostActions } from "../../../host-registration/testing/fake-host-actions.js";
import { FakeHostMarketplaceSources } from "../../../host-registration/testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../../host-registration/testing/fake-host-plugin-registry.js";
import { registeredCatalog } from "../../../tools/testing/catalog-of.js";

const PROJECT_ROOT = "/test-project";

function marketplace(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "github", repo: `ai-driven-dev/${name}` },
    scope: "project",
    addedAt: "2026-09-02T00:00:00Z",
  });
}

/** Keyed by marketplace name rather than tool — the default fake keys by tool alone,
 * which would resolve two marketplaces to the same built tree and the same catalog. */
function ensureBuiltPerMarketplace(): EnsureBuiltMarketplace {
  return {
    execute: async (options) => ({
      builtDir: `/built/${options.marketplace.name}`,
      version: "test",
      rebuilt: true,
    }),
  };
}

function seededCatalogs(): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    "/built/market-a/.claude-plugin/marketplace.json": JSON.stringify({
      name: "market-a",
      version: "1.0.0",
      plugins: [{ name: "plugin-a" }],
    }),
    "/built/market-b/.claude-plugin/marketplace.json": JSON.stringify({
      name: "market-b",
      version: "1.0.0",
      plugins: [{ name: "plugin-b" }],
    }),
  });
}

function manifestWithTwoPlugins(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool("claude", "test", []);
  manifest.addPlugin(
    "claude",
    InstalledPlugin.fromMetadata(
      "plugin-a",
      "1.0.0",
      { kind: "github", repo: "ai-driven-dev/A" },
      true,
      "project",
      "market-a"
    )
  );
  manifest.addPlugin(
    "claude",
    InstalledPlugin.fromMetadata(
      "plugin-b",
      "1.0.0",
      { kind: "github", repo: "ai-driven-dev/B" },
      true,
      "project",
      "market-b"
    )
  );
  return manifest;
}

function build(activator: FakeHostActions) {
  const registry = new InMemoryMarketplaceRegistry();
  const fs = seededCatalogs();
  const manifest = manifestWithTwoPlugins();
  const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
  const hasher = new DeterministicHasher();
  return {
    registry,
    fs,
    manifest,
    manifestRepo,
    useCase: new MarketplaceSyncSettingsUseCase(
      fs,
      manifestRepo,
      registry,
      hasher,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      ensureBuiltPerMarketplace(),
      new Map(),
      () => "",
      undefined,
      undefined,
      undefined,
      new Map([
        [
          "claude",
          new FakeHostPluginRegistry({
            location: "/host/installed_plugins.json",
            refs: new Map(),
          }),
        ],
      ]),
      undefined,
      new Map([
        [
          "claude",
          new FakeHostMarketplaceSources(
            activator,
            "registry",
            (path) =>
              path === "/built/market-a"
                ? "market-a"
                : path === "/built/market-b"
                  ? "market-b"
                  : undefined,
            new Map()
          ),
        ],
      ])
    ),
  };
}

describe("marketplaceNames narrows a sync run to the marketplaces named", () => {
  it("registers and enables only the named marketplace's own plugin", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry } = build(activator);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));

    await useCase.execute({
      tools: registeredCatalog(),
      projectRoot: PROJECT_ROOT,
      marketplaceNames: ["market-b"],
    });

    expect(activator.addedMarketplaces).toEqual(["/built/market-b"]);
    expect(activator.enabledPlugins).toEqual(["plugin-b@market-b"]);
  });

  it("keeps the untouched marketplace's own nativeRegistrations entry, never replacing it", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry, manifestRepo } = build(activator);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));
    // A first full run seeds both marketplaces' own registrations.
    await useCase.execute({ tools: registeredCatalog(), projectRoot: PROJECT_ROOT });

    await useCase.execute({
      tools: registeredCatalog(),
      projectRoot: PROJECT_ROOT,
      marketplaceNames: ["market-b"],
    });

    const reloaded = await manifestRepo.load();
    const registrations = reloaded?.getNativeRegistrations("claude");
    expect(registrations?.marketplaces).toEqual(
      expect.arrayContaining([
        {
          alias: "market-a",
          hostName: "market-a",
          provenance: { kind: "registry", source: "/built/market-a" },
        },
      ])
    );
    expect(registrations?.pluginRefs).toEqual(expect.arrayContaining(["plugin-a@market-a"]));
  });

  it("drops a stale ref for the touched marketplace by its hostName suffix, keeping the untouched marketplace's own refs", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry, manifest, manifestRepo } = build(activator);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        { alias: "market-a", hostName: "market-a" },
        { alias: "market-b", hostName: "market-b" },
      ],
      pluginRefs: ["plugin-a@market-a", "plugin-b-old@market-b"],
    });
    await manifestRepo.save(manifest);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));

    await useCase.execute({
      tools: registeredCatalog(),
      projectRoot: PROJECT_ROOT,
      marketplaceNames: ["market-b"],
    });

    const reloaded = await manifestRepo.load();
    const registrations = reloaded?.getNativeRegistrations("claude");
    expect(registrations?.pluginRefs).toContain("plugin-a@market-a");
    expect(registrations?.pluginRefs).toContain("plugin-b@market-b");
    expect(registrations?.pluginRefs).not.toContain("plugin-b-old@market-b");
  });

  it("returns the empty result and calls no activator at all for a name matching no registered marketplace", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry } = build(activator);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));

    const result = await useCase.execute({
      tools: registeredCatalog(),
      projectRoot: PROJECT_ROOT,
      marketplaceNames: ["nope"],
    });

    expect(result).toEqual({ activated: [], binaryMissing: [], warnings: [], errors: [] });
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
  });

  it("activates every registered marketplace when marketplaceNames is not given at all", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry } = build(activator);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));

    await useCase.execute({ tools: registeredCatalog(), projectRoot: PROJECT_ROOT });

    expect(activator.addedMarketplaces.sort()).toEqual(["/built/market-a", "/built/market-b"]);
    expect(activator.enabledPlugins.sort()).toEqual(["plugin-a@market-a", "plugin-b@market-b"]);
  });

  it("records exactly the named marketplace and its ref on a first narrowed run", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry, manifestRepo } = build(activator);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));

    await useCase.execute({
      tools: registeredCatalog(),
      projectRoot: PROJECT_ROOT,
      marketplaceNames: ["market-b"],
    });

    expect((await manifestRepo.load())?.getNativeRegistrations("claude")).toStrictEqual({
      binary: "claude",
      marketplaces: [
        {
          alias: "market-b",
          hostName: "market-b",
          provenance: { kind: "registry", source: "/built/market-b" },
        },
      ],
      pluginRefs: ["plugin-b@market-b"],
    });
  });

  it("drops a stale ref of either touched marketplace when narrowed to both", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, registry, manifest, manifestRepo } = build(activator);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "market-a",
          hostName: "market-a",
          provenance: { kind: "registry", source: "/built/market-a" },
        },
        {
          alias: "market-b",
          hostName: "market-b",
          provenance: { kind: "registry", source: "/built/market-b" },
        },
      ],
      pluginRefs: ["plugin-a@market-a", "plugin-b-old@market-b"],
    });
    await manifestRepo.save(manifest);
    await registry.save(PROJECT_ROOT, marketplace("market-a"));
    await registry.save(PROJECT_ROOT, marketplace("market-b"));

    await useCase.execute({
      tools: registeredCatalog(),
      projectRoot: PROJECT_ROOT,
      marketplaceNames: ["market-a", "market-b"],
    });

    expect((await manifestRepo.load())?.getNativeRegistrations("claude")).toStrictEqual({
      binary: "claude",
      marketplaces: [
        {
          alias: "market-a",
          hostName: "market-a",
          provenance: { kind: "registry", source: "/built/market-a" },
        },
        {
          alias: "market-b",
          hostName: "market-b",
          provenance: { kind: "registry", source: "/built/market-b" },
        },
      ],
      pluginRefs: ["plugin-a@market-a", "plugin-b@market-b"],
    });
  });
});
