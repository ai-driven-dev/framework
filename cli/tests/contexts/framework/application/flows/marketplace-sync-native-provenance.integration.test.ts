import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { AiToolId } from "../../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/project-a";
const CATALOG = "aidd-framework";
const PLUGIN_REF = `aidd-dev@${CATALOG}`;
const FOREIGN_REF = `someone-elses-plugin@${CATALOG}`;
const CACHE_WITNESS = "/fake-home/host-cache/aidd-framework/foreign-plugin/bytes";
const HOST_CATALOG_WITNESS = "/fake-home/host-catalog/aidd-framework/marketplace.json";
const FOREIGN_CATALOG_BYTES = '{"name":"aidd-framework","source":"foreign-repo","marker":7}';

class NamedActivator extends FakeNativePluginActivator {
  readonly refreshedCatalogs: string[] = [];

  override upgradeMarketplaces(name?: string): void {
    this.refreshedCatalogs.push(name ?? "<all>");
    super.upgradeMarketplaces();
  }
}

function makeSync(
  toolId: "codex" | "copilot",
  options: {
    machine?: Manifest;
    hostRefs?: ReadonlyMap<string, { enabled: boolean }>;
    conflictOnAdd?: boolean;
    projectNativePluginRefs?: readonly string[];
  } = {}
) {
  const builtDir = `/built/${toolId}`;
  const catalogPath =
    toolId === "codex"
      ? `${builtDir}/.agents/plugins/marketplace.json`
      : `${builtDir}/.plugin/marketplace.json`;
  const hostCatalogBytes = options.machine
    ? '{"name":"aidd-framework","source":"aidd-owned","marker":7}'
    : FOREIGN_CATALOG_BYTES;
  const fs = new InMemoryFileAdapter({
    [catalogPath]: JSON.stringify({
      name: CATALOG,
      version: "1.0.0",
      plugins: [{ name: "aidd-dev" }],
    }),
    [CACHE_WITNESS]: "foreign bytes stay byte-for-byte",
    [HOST_CATALOG_WITNESS]: hostCatalogBytes,
  });
  const project = Manifest.create();
  project.addTool(toolId, "1.0.0", []);
  project.addPlugin(
    toolId,
    InstalledPlugin.fromMetadata(
      "aidd-dev",
      "1.0.0",
      { kind: "local", path: "/framework" },
      true,
      "project",
      CATALOG
    )
  );
  if (options.projectNativePluginRefs !== undefined) {
    project.setNativeRegistrations(toolId, {
      binary: toolId,
      marketplaces: [],
      pluginRefs: options.projectNativePluginRefs,
    });
  }
  const projectRepo = new InMemoryManifestRepository(project, PROJECT_ROOT);
  const machineRepo = new InMemoryManifestRepository(options.machine ?? null);
  const registry = new InMemoryMarketplaceRegistry();
  registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: CATALOG,
      source: { kind: "local", path: "/framework" },
      scope: "user",
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  const activator = new NamedActivator({
    available: true,
    conflictOnAdd: options.conflictOnAdd ?? false,
  });
  const logger = new CapturingLogger();
  const hostRefs = options.hostRefs ?? new Map();
  const currentSource = options.machine
    ? builtDir
    : options.conflictOnAdd === true || hostRefs.has(FOREIGN_REF)
      ? "/fake-home/host-catalog/aidd-framework"
      : undefined;
  const useCase = new MarketplaceSyncSettingsUseCase(
    fs,
    projectRepo,
    registry,
    new DeterministicHasher(),
    logger,
    new Map([[toolId, activator]]),
    fakeEnsureBuiltMarketplace(() => builtDir),
    new Map(),
    () => "",
    undefined,
    undefined,
    undefined,
    new Map([
      [
        toolId as AiToolId,
        new FakeHostPluginRegistryReader({
          location: `/fake-home/${toolId}/registry`,
          refs: hostRefs,
        }),
      ],
    ]),
    machineRepo,
    new Map([
      [
        toolId as AiToolId,
        new FakeNativeMarketplaceSourceReader(
          activator,
          "effective-list",
          (path) => (path === builtDir ? CATALOG : undefined),
          currentSource === undefined
            ? new Map()
            : new Map([
                [
                  CATALOG,
                  {
                    kind: "effective-list",
                    root: currentSource,
                    sourceType: "local",
                    source: currentSource,
                  },
                ],
              ])
        ),
      ],
    ])
  );
  return { useCase, fs, projectRepo, machineRepo, activator, logger, hostCatalogBytes };
}

function canonicallyOwned(toolId: "codex" | "copilot"): Manifest {
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  machine.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [
      {
        alias: CATALOG,
        hostName: CATALOG,
        provenance: {
          kind: "effective-list",
          root: `/built/${toolId}`,
          sourceType: "local",
          source: `/built/${toolId}`,
        },
      },
    ],
    pluginRefs: [],
    pluginClaims: [{ ref: PLUGIN_REF, dependents: [PROJECT_ROOT] }],
  });
  return machine;
}

describe.each(["codex", "copilot"] as const)("%s native marketplace provenance", (toolId) => {
  it("leaves a foreign same-name catalogue, ref, and cache untouched", async () => {
    const fixture = makeSync(toolId, {
      conflictOnAdd: true,
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.activator.removedMarketplaces).toEqual([]);
    expect(fixture.activator.addedMarketplaces).toEqual([]);
    expect(fixture.activator.enabledPlugins).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(FOREIGN_CATALOG_BYTES);
    expect(fixture.machineRepo.getCurrent()).toBeNull();
    expect(result.warnings.join("\n")).toContain(CATALOG);
  });

  it("does not even re-add a same-name catalogue carrying a foreign ref", async () => {
    const fixture = makeSync(toolId, {
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.addedMarketplaces).toEqual([]);
    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.activator.enabledPlugins).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(FOREIGN_CATALOG_BYTES);
    expect(result.warnings.join("\n")).toContain("legacy claim has no source proof");
  });

  it("refreshes only an exact canonically owned catalogue without foreign refs", async () => {
    const fixture = makeSync(toolId, { machine: canonicallyOwned(toolId) });

    await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([CATALOG]);
    expect(fixture.activator.enabledPlugins).toEqual([PLUGIN_REF]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
  });

  it("refuses refresh when a foreign ref shares an AIDD-owned catalogue name", async () => {
    const fixture = makeSync(toolId, {
      machine: canonicallyOwned(toolId),
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(result.warnings.join("\n")).toContain(FOREIGN_REF);
  });

  it("does not treat a project-only native ref as machine ownership", async () => {
    const fixture = makeSync(toolId, {
      machine: canonicallyOwned(toolId),
      projectNativePluginRefs: [FOREIGN_REF],
      hostRefs: new Map([[FOREIGN_REF, { enabled: true }]]),
    });

    const result = await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.activator.addedMarketplaces).toEqual([]);
    expect(fixture.activator.enabledPlugins).toEqual([]);
    expect(fixture.activator.removedMarketplaces).toEqual([]);
    expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
    expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
    expect(result.warnings.join("\n")).toContain(FOREIGN_REF);
  });

  it("activates a freshly added AIDD ref without a redundant refresh", async () => {
    const fixture = makeSync(toolId);

    await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(fixture.activator.addedMarketplaces).toEqual([`/built/${toolId}`]);
    expect(fixture.activator.enabledPlugins).toEqual([PLUGIN_REF]);
    expect(fixture.activator.refreshedCatalogs).toEqual([]);
    expect(fixture.machineRepo.getCurrent()?.getNativeRegistrations(toolId)?.marketplaces).toEqual([
      {
        alias: CATALOG,
        hostName: CATALOG,
        provenance: {
          kind: "effective-list",
          root: `/built/${toolId}`,
          sourceType: "local",
          source: `/built/${toolId}`,
        },
      },
    ]);
  });
});
