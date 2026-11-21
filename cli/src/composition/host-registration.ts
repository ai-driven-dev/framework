import { EnabledPluginsMapReader } from "../contexts/host-registration/infrastructure/enabled-plugins-map-reader.js";
import { HostCliAdapter } from "../contexts/host-registration/infrastructure/host-cli-adapter.js";
import { HostRegistryMarketplaceSourceReaderAdapter } from "../contexts/host-registration/infrastructure/host-registry-marketplace-source-reader-adapter.js";
import { marketplaceListContract } from "../contexts/host-registration/infrastructure/marketplace-list-parsers.js";
import { InstallLocationsByNameReader } from "../contexts/host-registration/infrastructure/marketplace-registry-reader.js";
import { NativeMarketplaceSourceReaderAdapter } from "../contexts/host-registration/infrastructure/native-marketplace-source-reader-adapter.js";
import { PluginEntriesByScopeReader } from "../contexts/host-registration/infrastructure/plugin-entries-by-scope-reader.js";
import { TomlPluginTablesReader } from "../contexts/host-registration/infrastructure/toml-plugin-tables-reader.js";
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
import type { BuiltToolConfig } from "../contexts/tools/domain/profile/define-tool.js";
import { DuplicateToolIdError } from "../contexts/tools/domain/tools.error.js";
import { UnregisteredToolError } from "../shared/domain/shared.error.js";
import type { AiToolId, ToolId } from "../shared/domain/tool.js";
import { resolveHomeDir } from "../shared/infrastructure/home-dir.js";
import { REGISTERED_PROFILES } from "./tool-profiles.js";

/** One line per layout: a layout declared in a profile with no line here fails to compile. */
const PLUGIN_READERS = {
  "plugin-entries-by-scope": (file) => new PluginEntriesByScopeReader(file),
  "toml-plugin-tables": (file) => new TomlPluginTablesReader(file),
  "enabled-plugins-map": (file) => new EnabledPluginsMapReader(file),
} satisfies Record<PluginRegistryLayout, (file: string) => HostPluginRegistry>;

const MARKETPLACE_READERS = {
  "install-locations-by-name": (file) => new InstallLocationsByNameReader(file),
} satisfies Record<MarketplaceRegistryLayout, (file: string) => HostMarketplaceRegistry>;

/** The native activation each given profile declares, by tool id. A profile that declares none
 * has no entry, and a tool registered twice is refused rather than resolved to its first copy. */
export function nativeRegistrationsOf(
  profiles: readonly BuiltToolConfig[]
): ReadonlyMap<ToolId, NativeActivation> {
  const seen = new Set<ToolId>();
  const registrations = new Map<ToolId, NativeActivation>();
  for (const profile of profiles) {
    if (seen.has(profile.toolId)) throw new DuplicateToolIdError(profile.toolId);
    seen.add(profile.toolId);
    const activation = profile.kind === "ai" ? profile.nativeActivation() : undefined;
    if (activation !== undefined) registrations.set(profile.toolId, activation);
  }
  return registrations;
}

interface MutableWiring {
  hostActions: Map<string, HostActions>;
  pluginRegistries: Map<AiToolId, HostPluginRegistry>;
  marketplaceRegistries: Map<AiToolId, HostMarketplaceRegistry>;
  marketplaceSources: Map<AiToolId, HostMarketplaceSources>;
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
  const wiring: MutableWiring = {
    hostActions: new Map(),
    pluginRegistries: new Map(),
    marketplaceRegistries: new Map(),
    marketplaceSources: new Map(),
  };
  for (const aiId of tools.inHelpOrder("ai")) {
    if (tools.aiProfile(aiId).nativeActivation() === undefined) continue;
    const activation = registrations.get(aiId);
    if (activation === undefined) throw new UnregisteredToolError(aiId);
    wireHost({ aiId, activation, home }, wiring);
  }
  return wiring;
}

interface HostToWire {
  aiId: AiToolId;
  activation: NativeActivation;
  home: string;
}

function wireHost({ aiId, activation, home }: HostToWire, wiring: MutableWiring): void {
  const binary = activation.hostBinary();
  wiring.hostActions.set(binary, new HostCliAdapter(binary, activation.cliShape()));
  const pluginRegistry = activation.pluginRegistryAt(home);
  if (pluginRegistry !== undefined)
    wiring.pluginRegistries.set(aiId, PLUGIN_READERS[pluginRegistry.layout](pluginRegistry.path));
  const registry = marketplaceRegistryOf({ aiId, activation, home }, wiring);
  const sources = activation.marketplaceSourcesDeclaration();
  if (sources?.from === "marketplace-registry" && registry !== undefined)
    wiring.marketplaceSources.set(aiId, new HostRegistryMarketplaceSourceReaderAdapter(registry));
  if (sources?.from === "list-command")
    wiring.marketplaceSources.set(
      aiId,
      new NativeMarketplaceSourceReaderAdapter(marketplaceListContract(binary, sources))
    );
}

function marketplaceRegistryOf(
  { aiId, activation, home }: HostToWire,
  wiring: MutableWiring
): HostMarketplaceRegistry | undefined {
  const declared = activation.marketplaceRegistryAt(home);
  if (declared === undefined) return undefined;
  const registry = MARKETPLACE_READERS[declared.layout](declared.path);
  wiring.marketplaceRegistries.set(aiId, registry);
  return registry;
}
