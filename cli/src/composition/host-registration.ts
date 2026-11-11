import type {
  MarketplaceListLayout,
  MarketplaceRegistryLayout,
  MarketplaceSourcesDeclaration,
  PluginRegistryLayout,
} from "../contexts/tools/domain/plugins/native-activation.js";
import type { HostMarketplaceRegistryReader } from "../contexts/tools/domain/ports/host-marketplace-registry-reader.js";
import type { HostPluginRegistryReader } from "../contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type {
  NativeMarketplaceSourceListContract,
  NativeMarketplaceSourceReader,
} from "../contexts/tools/domain/ports/native-marketplace-source-reader.js";
import type { NativePluginActivator } from "../contexts/tools/domain/ports/native-plugin-activator.js";
import { nativeActivationOf } from "../contexts/tools/domain/registry.js";
import { InstallLocationsByNameReader } from "../contexts/tools/infrastructure/host-marketplace-registry-reader-adapter.js";
import {
  EnabledPluginsMapReader,
  PluginEntriesByScopeReader,
  TomlPluginTablesReader,
} from "../contexts/tools/infrastructure/host-plugin-registry-reader-adapter.js";
import {
  type MarketplaceListParser,
  parseMarketplacesWithSource,
  parseNameSourceRows,
} from "../contexts/tools/infrastructure/marketplace-list-parsers.js";
import {
  HostRegistryMarketplaceSourceReaderAdapter,
  NativeMarketplaceSourceReaderAdapter,
} from "../contexts/tools/infrastructure/native-marketplace-source-reader-adapter.js";
import { NativePluginCliAdapter } from "../contexts/tools/infrastructure/native-plugin-cli-adapter.js";
import { resolveHomeDir } from "../kernel/reading/home-dir.js";
import { AI_TOOL_IDS, type AiToolId } from "../kernel/tool.js";

/** One line per layout: a layout declared in a profile with no line here fails to compile. */
const PLUGIN_READERS = {
  "plugin-entries-by-scope": (file) => new PluginEntriesByScopeReader(file),
  "toml-plugin-tables": (file) => new TomlPluginTablesReader(file),
  "enabled-plugins-map": (file) => new EnabledPluginsMapReader(file),
} satisfies Record<PluginRegistryLayout, (file: string) => HostPluginRegistryReader>;

const MARKETPLACE_READERS = {
  "install-locations-by-name": (file) => new InstallLocationsByNameReader(file),
} satisfies Record<MarketplaceRegistryLayout, (file: string) => HostMarketplaceRegistryReader>;

const LIST_PARSERS = {
  "marketplaces-with-source": parseMarketplacesWithSource,
  "name-source-rows": parseNameSourceRows,
} satisfies Record<MarketplaceListLayout, MarketplaceListParser>;

/** The list-command contract one host's declaration describes, its parser chosen by layout. */
export function marketplaceListContract(
  binary: string,
  sources: Extract<MarketplaceSourcesDeclaration, { from: "list-command" }>
): NativeMarketplaceSourceListContract {
  const parse = LIST_PARSERS[sources.layout];
  return {
    binary,
    args: sources.args,
    parse: (output) => parse(sources.hostLabel, output),
    unavailableMessage: sources.unavailableMessage,
    unverifiedMessage: sources.unverifiedMessage,
  };
}

export interface HostRegistrationDeps {
  /** Keyed by the binary each activation declares. */
  hostActions: Map<string, NativePluginActivator>;
  pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistryReader>;
  marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistryReader>;
  marketplaceSources: ReadonlyMap<AiToolId, NativeMarketplaceSourceReader>;
}

/** Everything a host's own CLI and registries need, read off each tool's declared activation:
 * a new tool costs its profile and no edit here, a new layout one reader and one table line. */
export function wireHostRegistration(home: string = resolveHomeDir()): HostRegistrationDeps {
  const hostActions = new Map<string, NativePluginActivator>();
  const pluginRegistries = new Map<AiToolId, HostPluginRegistryReader>();
  const marketplaceRegistries = new Map<AiToolId, HostMarketplaceRegistryReader>();
  const marketplaceSources = new Map<AiToolId, NativeMarketplaceSourceReader>();
  for (const id of AI_TOOL_IDS) {
    const activation = nativeActivationOf(id);
    if (activation === undefined) continue;
    hostActions.set(activation.binary, new NativePluginCliAdapter(activation.binary, activation));
    const { pluginRegistry, marketplaceRegistry, marketplaceSources: sources } = activation;
    if (pluginRegistry !== undefined)
      pluginRegistries.set(
        id,
        PLUGIN_READERS[pluginRegistry.layout](pluginRegistry.location(home))
      );
    const registry =
      marketplaceRegistry === undefined
        ? undefined
        : MARKETPLACE_READERS[marketplaceRegistry.layout](marketplaceRegistry.location(home));
    if (registry !== undefined) marketplaceRegistries.set(id, registry);
    if (sources?.from === "marketplace-registry" && registry !== undefined)
      marketplaceSources.set(id, new HostRegistryMarketplaceSourceReaderAdapter(registry));
    if (sources?.from === "list-command") {
      marketplaceSources.set(
        id,
        new NativeMarketplaceSourceReaderAdapter(
          marketplaceListContract(activation.binary, sources)
        )
      );
    }
  }
  return { hostActions, pluginRegistries, marketplaceRegistries, marketplaceSources };
}
