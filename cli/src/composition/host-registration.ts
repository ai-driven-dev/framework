import { HostCliAdapter } from "../contexts/host-registration/infrastructure/host-cli-adapter.js";
import { marketplaceListContract } from "../contexts/host-registration/infrastructure/marketplace-list-parsers.js";
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
import type { HostActions } from "../contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceRegistry } from "../contexts/host-registration/ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../contexts/host-registration/ports/host-plugin-registry.js";
import type {
  MarketplaceRegistryLayout,
  PluginRegistryLayout,
} from "../contexts/tools/contract/native-registration-spec.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import type { NativeActivation } from "../contexts/tools/domain/native-registration/native-activation.js";
import { REGISTERED_PROFILES } from "../contexts/tools/domain/profiles/registered-profiles.js";
import { UnregisteredToolError } from "../shared/domain/errors.js";
import type { AiToolId, ToolId } from "../shared/domain/tool.js";
import { resolveHomeDir } from "../shared/infrastructure/home-dir.js";
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
  for (const aiId of tools.inHelpOrder("ai")) {
    if (tools.aiProfile(aiId).nativeActivation() === undefined) continue;
    const activation = registrations.get(aiId);
    if (activation === undefined) throw new UnregisteredToolError(aiId);
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
