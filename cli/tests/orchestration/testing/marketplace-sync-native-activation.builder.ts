import { resolve } from "node:path";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { parseJsonRecord } from "../../shared/testing/json-value.builder.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

/** The catalog and the tool id a scenario runs against, handed in by the test. */
export interface NativeActivationHost {
  readonly tools: ToolCatalog;
  readonly tool: AiToolId;
}

export const PROJECT_ROOT = "/test-project";
export const MARKETPLACE = "aidd-framework";
export const PLUGIN = "aidd-telemetry";
export const REF = `${PLUGIN}@${MARKETPLACE}`;

export function marketplace(): Marketplace {
  return Marketplace.create({
    name: MARKETPLACE,
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
    addedAt: "2026-09-02T00:00:00Z",
  });
}

function manifestWithPluginOf(
  { tool }: NativeActivationHost,
  marketplace: string = MARKETPLACE
): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool(tool, "test", []);
  manifest.addPlugin(
    tool,
    RecordedPlugin.fromMetadata({
      name: PLUGIN,
      version: "1.0.0",
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      strict: true,
      scope: "project",
      marketplace,
    })
  );
  return new InMemoryManifestRepository(manifest);
}

/** An unreadable built catalog is a hard failure (`UnreadableBuiltCatalogError`), so this
 * fixture must leave a readable one where `fakeEnsureBuiltMarketplace()` resolves the tool. */
export function seededBuiltCatalog(tool: AiToolId): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    [`/built/${tool}/.plugin/marketplace.json`]: JSON.stringify({
      name: MARKETPLACE,
      version: "1.0.0",
      plugins: [{ name: PLUGIN }],
    }),
  });
}

function readableHostPluginsOf({ tool }: NativeActivationHost, refs: readonly string[] = []) {
  return new Map([
    [
      tool,
      new FakeHostPluginRegistry({
        location: "/home/dev/.host/plugins/installed_plugins.json",
        refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
      }),
    ],
  ]);
}

interface NativeSourceSetup {
  readonly activator: FakeHostActions;
  readonly name?: string;
  readonly initial?: ReadonlyMap<string, { kind: "registry"; source: string } | null>;
}

function nativeSourceOf({ tool }: NativeActivationHost, setup: NativeSourceSetup) {
  const { activator, name = MARKETPLACE, initial = new Map() } = setup;
  return new Map([
    [
      tool,
      new FakeHostMarketplaceSources(
        activator,
        "registry",
        (path) => (path === `/built/${tool}` ? name : undefined),
        initial
      ),
    ],
  ]);
}

function ownedMachineCatalogOf(
  { tool }: NativeActivationHost,
  entry: { readonly hostName: string; readonly source: string }
): InMemoryManifestRepository {
  const { hostName, source } = entry;
  const machine = Manifest.create();
  machine.addTool(tool, "test", []);
  machine.setNativeRegistrations(tool, {
    binary: tool,
    marketplaces: [{ alias: MARKETPLACE, hostName, provenance: { kind: "registry", source } }],
    pluginRefs: [],
    pluginClaims: [],
  });
  return new InMemoryManifestRepository(machine);
}

function buildSyncOf(
  host: NativeActivationHost,
  activator: FakeHostActions,
  pluginMarketplace?: string
) {
  const { tool } = host;
  const registry = new InMemoryMarketplaceRegistry();
  const fs = seededBuiltCatalog(tool);
  const manifestRepo = manifestWithPluginOf(host, pluginMarketplace);
  return {
    registry,
    fs,
    manifestRepo,
    useCase: marketplaceSync({
      tools: host.tools,
      fs,
      manifestRepo,
      marketplaceRegistry: registry,
      logger: new CapturingLogger(),
      activators: new Map([[tool, activator]]),
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      hostPluginRegistries: readableHostPluginsOf(host),
      nativeSources: nativeSourceOf(host, { activator }),
    }),
  };
}

export function settingsPathOf(tool: AiToolId): string {
  return `.${tool}/settings.json`;
}

/** `resolve`, exactly as `syncMarketplacesFile` does: on Windows the production key is
 * the settings path under `C:\\test-project`, which a `/`-joined literal never addresses. */
export function settingsPathIn(projectRoot: string, tool: AiToolId): string {
  return resolve(projectRoot, settingsPathOf(tool));
}

/** The host's own CLI writes its `marketplace add` and `plugin enable` results into the very
 * file `syncTool` just hashed. The fake shells out to nothing, so it stands in for that write. */
export class ActivatorThatWritesSettings extends FakeHostActions {
  constructor(
    private readonly fs: InMemoryFileAdapter,
    private readonly settingsAbsolutePath: string
  ) {
    super({ available: true });
  }

  private readonly writes: Promise<void>[] = [];

  async settled(): Promise<void> {
    await Promise.all(this.writes);
  }

  private async appendHostState(): Promise<void> {
    const before = await this.fs.readFile(this.settingsAbsolutePath).catch(() => "{}");
    const json = parseJsonRecord(before);
    // Not a key this code writes: the point is content only the host could have put there.
    json.installedPluginsBookkeeping = { [REF]: { installedAt: "2026-09-05T00:00:00Z" } };
    await this.fs.writeFile(this.settingsAbsolutePath, JSON.stringify(json, null, 2));
  }

  override addMarketplace(source: string): void {
    super.addMarketplace(source);
    this.writes.push(this.appendHostState());
  }

  override enablePlugin(pluginRef: string): void {
    super.enablePlugin(pluginRef);
    this.writes.push(this.appendHostState());
  }
}

export function hostReadingOf(refs: readonly string[], enabled = true): HostPluginRegistryReading {
  return {
    location: "/home/dev/.host/plugins/installed_plugins.json",
    refs: new Map(refs.map((ref) => [ref, { enabled }])),
  };
}

function buildSyncReadingHostOf(
  host: NativeActivationHost,
  reading: {
    readonly activator: FakeHostActions;
    readonly hostRegistry: HostPluginRegistry;
    readonly catalogOwned: boolean;
  }
) {
  const { tool } = host;
  const { activator, hostRegistry, catalogOwned } = reading;
  const registry = new InMemoryMarketplaceRegistry();
  const manifestRepo = manifestWithPluginOf(host);
  const logger = new CapturingLogger();
  const machine = catalogOwned ? Manifest.create() : undefined;
  if (machine !== undefined) {
    machine.addTool(tool, "test", []);
    machine.setNativeRegistrations(tool, {
      binary: tool,
      marketplaces: [
        {
          alias: MARKETPLACE,
          hostName: MARKETPLACE,
          provenance: { kind: "registry", source: `/built/${tool}` },
        },
      ],
      pluginRefs: [],
      pluginClaims: [],
    });
  }
  const useCase = marketplaceSync({
    tools: host.tools,
    fs: seededBuiltCatalog(tool),
    manifestRepo,
    marketplaceRegistry: registry,
    logger,
    activators: new Map([[tool, activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    hostPluginRegistries: new Map([[tool, hostRegistry]]),
    userManifestRepo: machine === undefined ? undefined : new InMemoryManifestRepository(machine),
    nativeSources: nativeSourceOf(host, {
      activator,
      initial: catalogOwned
        ? new Map([[MARKETPLACE, { kind: "registry", source: `/built/${tool}` }]])
        : new Map(),
    }),
  });
  return { useCase, registry, manifestRepo, logger };
}

/** The scenario's builders, bound to the catalog and the tool id its test names. */
export function nativeActivationOf(host: NativeActivationHost) {
  return {
    tool: host.tool,
    manifestWithPlugin: (marketplace?: string) => manifestWithPluginOf(host, marketplace),
    readableHostPlugins: (refs?: readonly string[]) => readableHostPluginsOf(host, refs),
    nativeSource: (
      activator: FakeHostActions,
      name?: string,
      initial?: NativeSourceSetup["initial"]
    ) => nativeSourceOf(host, { activator, name, initial }),
    ownedMachineCatalog: (hostName: string, source: string) =>
      ownedMachineCatalogOf(host, { hostName, source }),
    buildSync: (activator: FakeHostActions, pluginMarketplace?: string) =>
      buildSyncOf(host, activator, pluginMarketplace),
    buildSyncReadingHost: (
      activator: FakeHostActions,
      hostRegistry: HostPluginRegistry,
      catalogOwned = false
    ) => buildSyncReadingHostOf(host, { activator, hostRegistry, catalogOwned }),
  };
}
