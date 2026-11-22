import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceRegistryReading } from "../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import type { NamedTools } from "../../shared/testing/named-tools.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export type ProvenanceTools = NamedTools<"claude" | "codex">;

/** A project that declares one plugin of the catalogue under the tool, or none. */
export function projectDeclaring(toolId: AiToolId, plugin = true): Manifest {
  const project = Manifest.create();
  project.addTool(toolId, "1.0.0", []);
  if (plugin) {
    project.addPlugin(
      toolId,
      RecordedPlugin.fromMetadata({
        name: "test-plugin",
        version: "1.0.0",
        source: { kind: "local", path: "/source" },
        strict: true,
        scope: "project",
        marketplace: "alias",
      })
    );
  }
  return project;
}

/** The registry a project keeps, holding the one catalogue alias the sync reads. */
export async function registryWithAlias(root: string, scope: Scope = "project") {
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    root,
    Marketplace.create({
      name: "alias",
      source: { kind: "local", path: "/source" },
      scope,
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  return registry;
}

/** A filesystem holding the built catalogue of a tool and the directories two projects and a foreign one occupy. */
export function catalogueFilesystem(catalogueFile: string, extra: Record<string, string> = {}) {
  return new InMemoryFileAdapter(
    {
      [catalogueFile]: JSON.stringify({ name: "same-name", plugins: [{ name: "test-plugin" }] }),
      ...extra,
    },
    ["/A", "/B", "/foreign"]
  );
}

export function foreignCacheFilesystem(catalogueFile: string) {
  const fs = catalogueFilesystem(catalogueFile);
  fs.setFile("/foreign/cache/marker.json", "foreign bytes");
  return fs;
}

function catalogueFileOf(toolId: AiToolId, codex: AiToolId) {
  const dir = toolId === codex ? ".agents/plugins" : ".claude-plugin";
  return `/built/${toolId}/${dir}/marketplace.json`;
}

export interface HostPluginProofOptions {
  tools: ToolCatalog;
  ids: ProvenanceTools;
  toolId?: AiToolId;
  catalogue?: HostMarketplaceRegistryReading;
  marketplaceScope?: Scope;
  plugin?: boolean;
}

export async function hostPluginProofFixture(
  reading: HostPluginRegistryReading | undefined,
  options: HostPluginProofOptions
) {
  const toolId = options.toolId ?? options.ids.codex;
  const builtDir = `/built/${toolId}`;
  const projectRepo = new InMemoryManifestRepository(projectDeclaring(toolId, options.plugin));
  const machineRepo = new InMemoryManifestRepository(Manifest.create());
  const registry = await registryWithAlias("/A", options.marketplaceScope);
  const fs = foreignCacheFilesystem(catalogueFileOf(toolId, options.ids.codex));
  const activator = new FakeHostActions({ available: true });
  const catalogue = options.catalogue;
  const sync = marketplaceSync({
    tools: options.tools,
    fs,
    manifestRepo: projectRepo,
    marketplaceRegistry: registry,
    logger: new CapturingLogger(),
    activators: new Map([[toolId, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    hostMarketplaceRegistries:
      catalogue === undefined ? new Map() : new Map([[toolId, { read: async () => catalogue }]]),
    hostPluginRegistries:
      reading === undefined ? new Map() : new Map([[toolId, new FakeHostPluginRegistry(reading)]]),
    userManifestRepo: machineRepo,
    nativeSources: new Map([
      [
        toolId,
        new FakeHostMarketplaceSources(
          activator,
          toolId === options.ids.codex ? "effective-list" : "registry",
          (path) => (path === builtDir ? "same-name" : undefined),
          new Map()
        ),
      ],
    ]),
  });
  return { sync, fs, activator, projectRepo, machineRepo };
}

function sourceOf(claude: AiToolId, toolId: AiToolId, path: string): NativeMarketplaceSource {
  if (toolId === claude) return { kind: "registry", source: path };
  return { kind: "effective-list", root: path, sourceType: "local", source: path };
}

/** The catalogue this sync owns, and one another project already claimed on the machine. */
export function ownedAndOtherCatalogues(claude: AiToolId, toolId: AiToolId, otherHost: string) {
  const target = {
    alias: "alias",
    hostName: "same-name",
    provenance: sourceOf(claude, toolId, `/built/${toolId}`),
  };
  const other = {
    alias: "other-alias",
    hostName: otherHost,
    provenance:
      otherHost === target.hostName ? target.provenance : sourceOf(claude, toolId, "/other/source"),
  };
  return { target, other, otherRef: `other-plugin@${otherHost}` };
}

/** What the host reports after the sync added the catalogue, for one way the proof can fail. */
export type PostAddProof =
  | "foreign source"
  | "foreign root"
  | "non-local source type"
  | "unreadable"
  | "missing catalogue"
  | "unproven catalogue";

function postAddEntry(proof: PostAddProof): NativeMarketplaceSource | null {
  if (proof === "unproven catalogue") return null;
  const foreign = proof === "foreign root" || proof === "foreign source";
  return {
    kind: "effective-list",
    root: foreign ? "/foreign" : "/built/codex",
    sourceType: proof === "non-local source type" ? "github" : "local",
    source: proof === "foreign source" ? "/foreign" : "/built/codex",
  };
}

export function codexSourceAfterAdd(
  activator: FakeHostActions,
  proof: PostAddProof
): HostMarketplaceSources {
  return {
    read: async () => {
      if (activator.addedMarketplaces.length === 0) return { location: "host", entries: new Map() };
      if (proof === "unreadable")
        return { location: "host", unreadable: "malformed source listing" };
      if (proof === "missing catalogue") return { location: "host", entries: new Map() };
      return { location: "host", entries: new Map([["same-name", postAddEntry(proof)]]) };
    },
  };
}

/** A sync of one project for one tool, whose host answers with the source and plugin listings given. */
export function syncOfDeclaredPlugin(options: {
  tools: ToolCatalog;
  toolId: AiToolId;
  fs: InMemoryFileAdapter;
  projectRepo: InMemoryManifestRepository;
  machineRepo: InMemoryManifestRepository;
  registry: InMemoryMarketplaceRegistry;
  activator: FakeHostActions;
  source: HostMarketplaceSources;
  pluginRefs?: ReadonlyMap<string, { enabled: boolean }>;
}) {
  return marketplaceSync({
    tools: options.tools,
    fs: options.fs,
    manifestRepo: options.projectRepo,
    marketplaceRegistry: options.registry,
    logger: new CapturingLogger(),
    activators: new Map([[options.toolId, options.activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    hostPluginRegistries: new Map([
      [
        options.toolId,
        new FakeHostPluginRegistry({
          location: "host-plugins",
          refs: options.pluginRefs ?? new Map(),
        }),
      ],
    ]),
    userManifestRepo: options.machineRepo,
    nativeSources: new Map([[options.toolId, options.source]]),
  });
}
