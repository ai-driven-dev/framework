import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostRefusal } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { syntheticNativeCatalog } from "../../shared/testing/synthetic-tool-id.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const PROJECT_ROOT = "/project-a";
export const CATALOG = "aidd-framework";
export const PLUGIN_REF = `aidd-dev@${CATALOG}`;
export const FOREIGN_REF = `someone-elses-plugin@${CATALOG}`;
export const CACHE_WITNESS = "/fake-home/host-cache/aidd-framework/foreign-plugin/bytes";
export const HOST_CATALOG_WITNESS = "/fake-home/host-catalog/aidd-framework/marketplace.json";
export const FOREIGN_CATALOG_BYTES = '{"name":"aidd-framework","source":"foreign-repo","marker":7}';

export class NamedActivator extends FakeHostActions {
  readonly refreshedCatalogs: string[] = [];

  override upgradeMarketplaces(name?: string): HostRefusal {
    this.refreshedCatalogs.push(name ?? "<all>");
    super.upgradeMarketplaces();
    return undefined;
  }
}

export interface SyncOptions {
  machine?: Manifest;
  hostRefs?: ReadonlyMap<string, { enabled: boolean }>;
  conflictOnAdd?: boolean;
  projectNativePluginRefs?: readonly string[];
  hostReader?: HostPluginRegistry;
  sourceReader?: HostMarketplaceSources;
}

function seededFiles(builtDir: string, hostCatalogBytes: string) {
  return new InMemoryFileAdapter(
    {
      [`${builtDir}/.plugin/marketplace.json`]: JSON.stringify({
        name: CATALOG,
        version: "1.0.0",
        plugins: [{ name: "aidd-dev" }],
      }),
      [CACHE_WITNESS]: "foreign bytes stay byte-for-byte",
      [HOST_CATALOG_WITNESS]: hostCatalogBytes,
    },
    [PROJECT_ROOT]
  );
}

function projectManifestOf(toolId: AiToolId, nativePluginRefs: readonly string[] | undefined) {
  const project = Manifest.create();
  project.addTool(toolId, "test", []);
  project.addPlugin(
    toolId,
    RecordedPlugin.fromMetadata({
      name: "aidd-dev",
      version: "1.0.0",
      source: { kind: "local", path: "/framework" },
      strict: true,
      scope: "project",
      marketplace: CATALOG,
    })
  );
  if (nativePluginRefs !== undefined) {
    project.setNativeRegistrations(toolId, {
      binary: toolId,
      marketplaces: [],
      pluginRefs: nativePluginRefs,
    });
  }
  return project;
}

function currentSourceOf(
  options: SyncOptions,
  builtDir: string,
  hostRefs: ReadonlyMap<string, unknown>
) {
  if (options.machine) return builtDir;
  const foreign = options.conflictOnAdd === true || hostRefs.has(FOREIGN_REF);
  return foreign ? "/fake-home/host-catalog/aidd-framework" : undefined;
}

function knownSources(currentSource: string | undefined) {
  if (currentSource === undefined) return new Map();
  return new Map([
    [
      CATALOG,
      {
        kind: "effective-list" as const,
        root: currentSource,
        sourceType: "local",
        source: currentSource,
      },
    ],
  ]);
}

export function makeSync(toolId: AiToolId, options: SyncOptions = {}) {
  const builtDir = `/built/${toolId}`;
  const hostCatalogBytes = options.machine
    ? '{"name":"aidd-framework","source":"aidd-owned","marker":7}'
    : FOREIGN_CATALOG_BYTES;
  const fs = seededFiles(builtDir, hostCatalogBytes);
  const projectRepo = new InMemoryManifestRepository(
    projectManifestOf(toolId, options.projectNativePluginRefs),
    PROJECT_ROOT
  );
  const machineRepo = new InMemoryManifestRepository(options.machine ?? null);
  const registry = new InMemoryMarketplaceRegistry();
  registry.seed(
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
  const currentSource = currentSourceOf(options, builtDir, hostRefs);
  const hostReader =
    options.hostReader ??
    new FakeHostPluginRegistry({ location: `/fake-home/${toolId}/registry`, refs: hostRefs });
  const sourceReader =
    options.sourceReader ??
    new FakeHostMarketplaceSources(
      activator,
      "effective-list",
      (path) => (path === builtDir ? CATALOG : undefined),
      knownSources(currentSource)
    );
  const useCase = marketplaceSync({
    tools: syntheticNativeCatalog(toolId, "list-command"),
    fs,
    manifestRepo: projectRepo,
    marketplaceRegistry: registry,
    logger,
    activators: new Map([[toolId, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(() => builtDir),
    hostPluginRegistries: new Map([[toolId, hostReader]]),
    userManifestRepo: machineRepo,
    nativeSources: new Map([[toolId, sourceReader]]),
  });
  return { useCase, fs, projectRepo, machineRepo, registry, activator, logger, hostCatalogBytes };
}

export function canonicallyOwned(toolId: AiToolId): Manifest {
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
