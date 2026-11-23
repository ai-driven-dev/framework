import { join } from "node:path";
import { CheckMarketplaceSource } from "../../contexts/host-registration/application/check-marketplace-source.use-case.js";
import type { CatalogReaders } from "../../contexts/host-registration/application/register/registration-run.js";
import type {
  MarketplaceRegistryLayout,
  PluginRegistryLayout,
} from "../../contexts/host-registration/contract/native-registration-spec.js";
import type { NativeActivation } from "../../contexts/host-registration/domain/native-registration/native-activation.js";
import {
  withEnabledPlugins,
  withoutMarketplaces,
} from "../../contexts/host-registration/domain/settings-declaration.js";
import { HostCliAdapter } from "../../contexts/host-registration/infrastructure/host-cli-adapter.js";
import { HostRegistryMarketplaceSourceReaderAdapter } from "../../contexts/host-registration/infrastructure/marketplace/host-registry-marketplace-source-reader-adapter.js";
import { marketplaceListContract } from "../../contexts/host-registration/infrastructure/marketplace/marketplace-list-parsers.js";
import {
  catalogIdentityReader,
  InstallLocationsByNameReader,
} from "../../contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import { NativeMarketplaceSourceReaderAdapter } from "../../contexts/host-registration/infrastructure/marketplace/native-marketplace-source-reader-adapter.js";
import { EnabledPluginsMapReader } from "../../contexts/host-registration/infrastructure/plugin-registry/enabled-plugins-map-reader.js";
import { PluginEntriesByScopeReader } from "../../contexts/host-registration/infrastructure/plugin-registry/plugin-entries-by-scope-reader.js";
import { TomlPluginTablesReader } from "../../contexts/host-registration/infrastructure/plugin-registry/toml-plugin-tables-reader.js";
import type { HostActions } from "../../contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceRegistry } from "../../contexts/host-registration/ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../../contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../contexts/host-registration/ports/host-plugin-registry.js";
import type { RegistrationRecordRepository } from "../../contexts/host-registration/ports/registration-record-repository.js";
import { DuplicateToolIdError } from "../../contexts/tools/domain/tools.error.js";
import type { SettingsDeclarationRules } from "../../orchestration/sync/settings/sync-tool-settings-files.use-case.js";
import { asPlainObject } from "../../shared/domain/reading/plain-object.js";
import { UnregisteredToolError } from "../../shared/domain/shared.error.js";
import type { AiToolId, ToolId } from "../../shared/domain/tool.js";
import {
  ToolKeyedJsonFile,
  type ToolKeyedJsonFileDeps,
} from "../../shared/infrastructure/tool-keyed-json-file.js";
import type { FileReader } from "../../shared/ports/file-reader.js";
import { REGISTERED_PROFILES, type RegisteredProfile } from "../tool-profiles/index.js";
import type { RegisteredCatalog } from "./tools.js";

/** The new content of a tool's shared settings file, answered by the host registration that owns it. */
export const settingsDeclaration: SettingsDeclarationRules = {
  withoutMarketplaces,
  withEnabledPlugins,
};

/** What reads a catalogue: its declared identity, and whether a host holds a different one. */
export function catalogReaders(fs: FileReader): CatalogReaders {
  const identities = catalogIdentityReader(fs);
  return { identities, checkSource: new CheckMarketplaceSource(fs, identities) };
}

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
  profiles: readonly RegisteredProfile[]
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
  tools: RegisteredCatalog,
  home: string,
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

/** The host data of every tool's record, in one file beside the manifest of its scope. */
export function registrationRecordFile(
  dir: () => string,
  deps: ToolKeyedJsonFileDeps
): RegistrationRecordRepository {
  return new ToolKeyedJsonFile(
    () => join(dir(), "host-registrations.json"),
    deps,
    (value) => {
      const record = asPlainObject(value);
      return record === null ? null : { ...record };
    }
  );
}
