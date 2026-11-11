import type { HostActions } from "../contexts/host-registration/contract/host-actions.js";
import type { HostMarketplaceRegistry } from "../contexts/host-registration/contract/host-marketplace-registry.js";
import type {
  HostMarketplaceSources,
  NativeMarketplaceSourceListContract,
} from "../contexts/host-registration/contract/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../contexts/host-registration/contract/host-plugin-registry.js";
import { HostCliAdapter } from "../contexts/host-registration/infrastructure/host-cli-adapter.js";
import {
  type MarketplaceListParser,
  parseMarketplacesWithSource,
  parseNameSourceRows,
} from "../contexts/host-registration/infrastructure/marketplace-list-parsers.js";
import { InstallLocationsByNameReader } from "../contexts/host-registration/infrastructure/marketplace-registry-reader.js";
import {
  HostRegistryMarketplaceSourceReaderAdapter,
  NativeMarketplaceSourceReaderAdapter,
} from "../contexts/host-registration/infrastructure/marketplace-source-readers.js";
import {
  EnabledPluginsMapReader,
  PluginEntriesByScopeReader,
  TomlPluginTablesReader,
} from "../contexts/host-registration/infrastructure/plugin-registry-readers.js";
import type {
  MarketplaceListLayout,
  MarketplaceRegistryLayout,
  MarketplaceSourcesDeclaration,
  PluginRegistryLayout,
} from "../contexts/tools/domain/plugins/native-activation.js";
import { nativeActivationOf } from "../contexts/tools/domain/registry.js";
import { resolveHomeDir } from "../kernel/reading/home-dir.js";
import { AI_TOOL_IDS, type AiToolId } from "../kernel/tool.js";

/** One line per layout: a layout declared in a profile with no line here fails to compile. */
const PLUGIN_READERS = {
  "plugin-entries-by-scope": (file) => new PluginEntriesByScopeReader(file),
  "toml-plugin-tables": (file) => new TomlPluginTablesReader(file),
  "enabled-plugins-map": (file) => new EnabledPluginsMapReader(file),
} satisfies Record<PluginRegistryLayout, (file: string) => HostPluginRegistry>;

const MARKETPLACE_READERS = {
  "install-locations-by-name": (file) => new InstallLocationsByNameReader(file),
} satisfies Record<MarketplaceRegistryLayout, (file: string) => HostMarketplaceRegistry>;

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
  hostActions: ReadonlyMap<string, HostActions>;
  pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
  marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  marketplaceSources: ReadonlyMap<AiToolId, HostMarketplaceSources>;
}

/** Everything a host's own CLI and registries need, read off each tool's declared activation:
 * a new tool costs its profile and no edit here, a new layout one reader and one table line. */
export function wireHostRegistration(home: string = resolveHomeDir()): HostRegistrationDeps {
  const hostActions = new Map<string, HostActions>();
  const pluginRegistries = new Map<AiToolId, HostPluginRegistry>();
  const marketplaceRegistries = new Map<AiToolId, HostMarketplaceRegistry>();
  const marketplaceSources = new Map<AiToolId, HostMarketplaceSources>();
  for (const id of AI_TOOL_IDS) {
    const activation = nativeActivationOf(id);
    if (activation === undefined) continue;
    hostActions.set(activation.binary, new HostCliAdapter(activation.binary, activation));
    const { pluginRegistry, marketplaceRegistry, marketplaceSources: sources } = activation;
    if (pluginRegistry !== undefined)
      pluginRegistries.set(
        id,
        PLUGIN_READERS[pluginRegistry.layout](pluginRegistry.location(home))
      );
    if (marketplaceRegistry !== undefined) {
      const registry = MARKETPLACE_READERS[marketplaceRegistry.layout](
        marketplaceRegistry.location(home)
      );
      marketplaceRegistries.set(id, registry);
      if (sources?.from === "marketplace-registry")
        marketplaceSources.set(id, new HostRegistryMarketplaceSourceReaderAdapter(registry));
    }
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
