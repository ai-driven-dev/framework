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
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import type {
  MarketplaceListLayout,
  MarketplaceRegistryLayout,
  MarketplaceSourcesDeclaration,
  NativeActivation,
  PluginRegistryLayout,
} from "../contexts/tools/domain/native-registration/native-activation.js";
import { REGISTERED_PROFILES } from "../contexts/tools/domain/profiles/registered-profiles.js";
import { UnregisteredToolError } from "../kernel/errors.js";
import { resolveHomeDir } from "../kernel/reading/home-dir.js";
import type { AiToolId, ToolId } from "../kernel/tool.js";
import { nativeRegistrationsOf } from "./native-registrations.js";

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
export function wireHostRegistration(
  tools: ToolCatalog,
  home: string = resolveHomeDir(),
  registrations: ReadonlyMap<ToolId, NativeActivation> = nativeRegistrationsOf(REGISTERED_PROFILES)
): HostRegistrationDeps {
  const hostActions = new Map<string, HostActions>();
  const pluginRegistries = new Map<AiToolId, HostPluginRegistry>();
  const marketplaceRegistries = new Map<AiToolId, HostMarketplaceRegistry>();
  const marketplaceSources = new Map<AiToolId, HostMarketplaceSources>();
  for (const id of tools.inHelpOrder("ai")) {
    const aiId = id as AiToolId;
    if (tools.aiProfile(aiId).nativeActivation() === undefined) continue;
    const activation = registrations.get(id);
    if (activation === undefined) throw new UnregisteredToolError(id);
    const binary = activation.hostBinary();
    hostActions.set(binary, new HostCliAdapter(binary, activation.cliShape()));
    const pluginRegistry = activation.pluginRegistryAt(home);
    const marketplaceRegistry = activation.marketplaceRegistryAt(home);
    const sources = activation.marketplaceSourcesDeclaration();
    if (pluginRegistry !== undefined)
      pluginRegistries.set(aiId, PLUGIN_READERS[pluginRegistry.layout](pluginRegistry.path));
    if (marketplaceRegistry !== undefined) {
      const registry = MARKETPLACE_READERS[marketplaceRegistry.layout](marketplaceRegistry.path);
      marketplaceRegistries.set(aiId, registry);
      if (sources?.from === "marketplace-registry")
        marketplaceSources.set(aiId, new HostRegistryMarketplaceSourceReaderAdapter(registry));
    }
    if (sources?.from === "list-command") {
      marketplaceSources.set(
        aiId,
        new NativeMarketplaceSourceReaderAdapter(marketplaceListContract(binary, sources))
      );
    }
  }
  return { hostActions, pluginRegistries, marketplaceRegistries, marketplaceSources };
}
