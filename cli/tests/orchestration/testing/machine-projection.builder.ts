import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostPluginRegistryEntry } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { HostMarketplaceRegistry } from "../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import type { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

/** The projects these cases sync from exist on disk before anything is installed into them. */
export const fsWithProjects = (seed: Record<string, string>) =>
  new InMemoryFileAdapter(seed, ["/project", "/B", "/listed-project", "/resolved-listed-project"]);

export const freshNativeSources = (
  toolId: AiToolId,
  activator: FakeHostActions,
  identities: ReadonlyMap<string, string>,
  initial: ReadonlyMap<string, NativeMarketplaceSource> = new Map(),
  kind: "registry" | "effective-list" = "registry"
) =>
  new Map([
    [
      toolId,
      new FakeHostMarketplaceSources(activator, kind, (path) => identities.get(path), initial),
    ],
  ]);

export const readablePlugins = (
  toolId: AiToolId,
  refs: ReadonlyMap<string, HostPluginRegistryEntry> = new Map(),
  home: string = toolId
) =>
  new Map([
    [
      toolId,
      new FakeHostPluginRegistry({
        location: `/home/${home}/plugins/installed_plugins.json`,
        refs,
      }),
    ],
  ]);

export const hostCatalogs = (toolId: AiToolId, entries: ReadonlyMap<string, string> = new Map()) =>
  new Map<AiToolId, HostMarketplaceRegistry>([
    [
      toolId,
      {
        read: async () => ({
          location: `/home/.${toolId}/known_marketplaces.json`,
          entries: new Map(entries),
        }),
      },
    ],
  ]);

export const unreadableHostPlugins = (toolId: AiToolId) => {
  const unreadable: HostPluginRegistry = {
    read: async () => {
      throw new Error("host plugin registry unreadable");
    },
  };
  return new Map([[toolId, unreadable]]);
};

/** Every marketplace builds into a directory named after it, as a real build would. */
export const builtPerMarketplace: BuiltMarketplaceEnsurer = {
  execute: async ({ marketplace }) => ({
    builtDir: `/built/${marketplace.name}`,
    version: "1.0.0",
    rebuilt: true,
  }),
};

export function catalogFile(name: string, pluginNames: readonly string[]): string {
  return JSON.stringify({
    name,
    version: "1.0.0",
    plugins: pluginNames.map((pluginName) => ({ name: pluginName })),
  });
}

export function pluginIn(alias: string, scope: Scope, name = "test-plugin", path = "/source") {
  return RecordedPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "local", path },
    strict: true,
    scope,
    marketplace: alias,
  });
}

export function projectWithPlugin(toolId: AiToolId, alias: string, scope: Scope = "project") {
  const project = Manifest.create();
  project.addTool(toolId, "1.0.0", []);
  project.addPlugin(toolId, pluginIn(alias, scope));
  return project;
}

export function manifestWithTool(toolId: AiToolId) {
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  return machine;
}

export interface RegisteredMarketplace {
  readonly name: string;
  readonly scope: Scope;
  readonly path?: string;
}

export async function registryOf(projectRoot: string, ...marketplaces: RegisteredMarketplace[]) {
  const registry = new InMemoryMarketplaceRegistry();
  for (const { name, scope, path } of marketplaces) {
    await registry.save(
      projectRoot,
      Marketplace.create({
        name,
        source: { kind: "local", path: path ?? "/source" },
        scope,
        addedAt: "2026-09-15T00:00:00Z",
      })
    );
  }
  return registry;
}

export interface SyncWiring {
  readonly tools: ToolCatalog;
  readonly toolId: AiToolId;
  readonly fs: InMemoryFileAdapter;
  readonly projectRepo: InMemoryManifestRepository;
  readonly machineRepo: InMemoryManifestRepository;
  readonly registry: InMemoryMarketplaceRegistry;
  readonly activator: FakeHostActions;
  readonly hostPluginRegistries: ReturnType<typeof readablePlugins | typeof unreadableHostPlugins>;
  readonly hostMarketplaceRegistries?: ReturnType<typeof hostCatalogs>;
  readonly ensureBuilt?: BuiltMarketplaceEnsurer;
  readonly nativeSources?: ReturnType<typeof freshNativeSources>;
}

export function wireSync(w: SyncWiring) {
  return marketplaceSync({
    tools: w.tools,
    fs: w.fs,
    manifestRepo: w.projectRepo,
    marketplaceRegistry: w.registry,
    logger: new CapturingLogger(),
    activators: new Map([[w.toolId, w.activator]]),
    ensureBuilt: w.ensureBuilt ?? fakeEnsureBuiltMarketplace(),
    hostMarketplaceRegistries: w.hostMarketplaceRegistries,
    hostPluginRegistries: w.hostPluginRegistries,
    userManifestRepo: w.machineRepo,
    nativeSources: w.nativeSources,
  });
}

/** One project-scope catalogue on a list-command host, `local-catalog` locally and `real-catalog` on the host. */
export async function singleListedCatalog(o: {
  readonly tools: ToolCatalog;
  readonly tool: AiToolId;
  readonly projectRoot: string;
  readonly machine: Manifest;
  readonly activator: FakeHostActions;
  /** When given, the host plugin registry is this one and no native source reader is wired. */
  readonly hostPluginRegistries?: SyncWiring["hostPluginRegistries"];
}) {
  const projectRepo = new InMemoryManifestRepository(projectWithPlugin(o.tool, "local-catalog"));
  const machineRepo = new InMemoryManifestRepository(o.machine);
  const fs = fsWithProjects({
    [`/built/${o.tool}/.plugin/marketplace.json`]: catalogFile("real-catalog", ["test-plugin"]),
  });
  const sync = wireSync({
    tools: o.tools,
    toolId: o.tool,
    fs,
    projectRepo,
    machineRepo,
    registry: await registryOf(o.projectRoot, { name: "local-catalog", scope: "project" }),
    activator: o.activator,
    hostPluginRegistries: o.hostPluginRegistries ?? readablePlugins(o.tool),
    nativeSources:
      o.hostPluginRegistries === undefined
        ? freshNativeSources(
            o.tool,
            o.activator,
            new Map([[`/built/${o.tool}`, "real-catalog"]]),
            new Map(),
            "effective-list"
          )
        : undefined,
  });
  return { sync, fs, projectRepo, machineRepo };
}
