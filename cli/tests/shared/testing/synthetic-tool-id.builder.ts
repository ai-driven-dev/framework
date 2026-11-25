import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import type {
  MarketplaceSettings,
  NativeActivationSpec,
} from "../../../src/contexts/host-registration/contract/native-registration-spec.js";
import { withNativeRegistration } from "../../../src/contexts/host-registration/domain/native-registration/native-host-profile.js";
import { sharedMarketplaceKey } from "../../../src/contexts/tools/domain/marketplace-entry.js";
import {
  defineAiTool,
  defineIdeTool,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { ConfigSection } from "../../../src/contexts/tools/domain/sections/config-section.js";
import {
  type NativeLayoutParams,
  nativeLayout,
} from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../../src/contexts/tools/domain/sections/manifest-section.js";
import { ModelsSection } from "../../../src/contexts/tools/domain/sections/models-section.js";
import type { BuiltToolConfig } from "./catalog-of.builder.js";
import { catalogOf } from "./catalog-of.builder.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

/** The one file an install of a synthetic tool writes, so that a tool has something to update or lose. */
function shippedSettings(name: string, delivery: "install" | "section") {
  return {
    name: "settings.json",
    content: "{}\n",
    destination: `.${name}/settings.json`,
    delivery,
  };
}

/** A flat synthetic AI tool under `name`, running the agents on the given providers when any. */
export function syntheticConfig(name: string, providers: readonly string[] = []) {
  return defineAiTool({
    toolId: name,
    directory: `.${name}/`,
    toolSuffix: `.${name}.md`,
    signalDir: null,
    displayName: name,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: providers.length === 0 ? {} : { models: new ModelsSection({ providers }) },
    linkSyntax: [],
    configAssets: [shippedSettings(name, "install")],
  });
}

const CONFIGS = [syntheticConfig("synthetic"), syntheticConfig("syntheticb")] as const;

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = CONFIGS[0].toolId;
/** A second tool id no registry lists, for a test that tells two tools apart. */
export const SECOND_SYNTHETIC_TOOL = CONFIGS[1].toolId;

/** A synthetic AI tool id of its own, for a test that tells apart more tools than the two above. */
export function syntheticToolId(name: string) {
  return syntheticConfig(`synthetic${name}`).toolId;
}

const IDE_DIRECTORY = ".syntheticide/";
const IDE_FILES = [
  {
    name: "extensions.json",
    merge: "user-prime",
    content: { recommendations: ["a.b"], unwantedRecommendations: ["c.d"] },
  },
  {
    name: "keybindings.json",
    merge: "none",
    content: [{ key: "ctrl+k", command: "synthetic.run" }],
  },
  { name: "settings.json", merge: "user-prime", content: { "editor.tabSize": 2 } },
] as const;

/** The synthetic IDE tool profile, for a catalog that lists it beside other synthetic tools. */
export const SYNTHETIC_IDE_CONFIG = defineIdeTool({
  toolId: "syntheticide",
  directory: IDE_DIRECTORY,
  signalDir: null,
  capabilities: {
    config: IDE_FILES.map(
      (file) =>
        new ConfigSection({ outputPath: `${IDE_DIRECTORY}${file.name}`, mergeStrategy: file.merge })
    ),
  },
  configAssets: IDE_FILES.map((file) => ({
    name: file.name,
    content: file.content,
    destination: `${IDE_DIRECTORY}${file.name}`,
    delivery: "section" as const,
  })),
});

/** An IDE tool id no registry lists, for a test that tells the two categories apart. */
export const SYNTHETIC_IDE_TOOL = SYNTHETIC_IDE_CONFIG.toolId;

/** The synthetic IDE tool and both AI tools, the first running the agents on anthropic and the
 * second on openai: for a test that reads both categories or the providers the tools run. Any
 * `extra` profile is listed after them. */
export function syntheticMixedCatalog(extra: readonly BuiltToolConfig[] = []): RegisteredCatalog {
  return catalogOf([...syntheticMixedConfigs(), ...extra]);
}

/** The profiles of the mixed catalog, for a catalog that lists more tools beside them. */
export function syntheticMixedConfigs() {
  return [
    syntheticConfig(SYNTHETIC_TOOL, ["anthropic"]),
    syntheticConfig(SECOND_SYNTHETIC_TOOL, ["openai"]),
    SYNTHETIC_IDE_CONFIG,
  ];
}

/** A catalog listing only the synthetic tools: what a generic test hands code that asks its tools. */
export function syntheticCatalog(): RegisteredCatalog {
  return catalogOf(CONFIGS);
}

/** The tool ids a setup flow is built over, read from the given synthetic catalog, the mixed one by
 * default: a flow test names no registered tool. */
export function syntheticFlowTools(tools: RegisteredCatalog = syntheticMixedCatalog()) {
  return {
    registeredToolIds: tools.idsInCanonicalOrder(),
    aiToolIds: tools.idsInCanonicalOrder("ai"),
    ideToolIds: tools.idsInCanonicalOrder("ide"),
  };
}

/** What a host keeps under its own home directory, the root every host path derives from. */
export const homeDir = (id: string, ...parts: string[]): string =>
  ["{home}", `.${id}`, ...parts].join("/");

/** A host whose plugins carry the install verbs and a registry file of their own. */
function installingHost(id: string): Partial<NativeActivationSpec> {
  return {
    enableVerb: "install",
    disableVerb: "uninstall",
    upgradeVerb: "update",
    pluginRegistry: {
      location: homeDir(id, "plugins", "installed_plugins.json"),
      layout: "plugin-entries-by-scope",
    },
  };
}

/** A host that also takes its scope as a flag. */
function scopedHost(id: string): Partial<NativeActivationSpec> {
  return {
    ...installingHost(id),
    scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
  };
}

/** A host that lists its catalogue sources by command: the one shape every listing host shares. */
function listedHost(id: string): Partial<NativeActivationSpec> {
  return {
    marketplaceSources: {
      from: "list-command",
      args: ["marketplace", "list"],
      layout: "marketplaces-with-source",
      hostLabel: id,
      unavailableMessage: `${id} marketplace list unavailable`,
      unverifiedMessage: `${id} marketplace list output shape is not verified`,
    },
  };
}

/** A host that keeps its catalogue sources in a registry file: the one shape every registry host shares. */
export function registryHost(id: string): Partial<NativeActivationSpec> {
  return {
    ...scopedHost(id),
    marketplaceSources: { from: "marketplace-registry" },
    marketplaceRegistry: {
      location: homeDir(id, "plugins", "known_marketplaces.json"),
      layout: "install-locations-by-name",
    },
  };
}

/** What a synthetic native tool takes beyond its host verbs: layout fields, the settings it
 * declares marketplaces in, models and its catalogue file. */
interface NativeToolParts {
  readonly layout?: Partial<NativeLayoutParams>;
  readonly marketplace?: MarketplaceSettings;
  readonly models?: ModelsSection;
  readonly catalogue?: string;
  readonly rootToken?: string;
  readonly manifestFile?: string;
  readonly buildsMarketplace?: boolean;
}

/** One synthetic AI tool driven through its own host CLI the way a native tool is. */
export function syntheticNativeTool(
  id: string,
  native: Partial<NativeActivationSpec> = {},
  parts: NativeToolParts = {}
) {
  const activation: NativeActivationSpec = {
    binary: id,
    upgradeVerb: "upgrade",
    enableVerb: "add",
    disableVerb: "remove",
    pluginCacheDir: homeDir(id, "plugins", "cache"),
    ...native,
  };
  const profile = defineAiTool({
    toolId: id,
    distributionProbes: {
      manifest: [parts.manifestFile ?? ".plugin/plugin.json"],
      marketplace: [parts.catalogue ?? ".plugin/marketplace.json"],
    },
    directory: `.${id}/`,
    toolSuffix: `.${id}.md`,
    signalDir: null,
    displayName: id,
    buildContracts: {
      flat: () => anEmptyContract(),
      ...(parts.buildsMarketplace ? { marketplace: () => anEmptyContract() } : {}),
    },
    capabilities: {
      layout: nativeLayout({
        pluginsDir: `.${id}/plugins/`,
        ...parts.layout,
      }),
      manifest: manifestSection({
        manifestRelativePath: "plugin.json",
        pluginRootToken: parts.rootToken ?? ".",
      }),
      hooks: { delivery: { kind: "plugin-file" } },
      ...(parts.models === undefined ? {} : { models: parts.models }),
    },
    linkSyntax: [],
  });
  return withNativeRegistration(profile, { activation, marketplace: parts.marketplace });
}

/** How the synthetic host answers which marketplaces it knows: from a registry file it keeps
 * and a settings file the project carries, from a list its own command prints, or from that
 * list plus a shared settings file that only declares plugins the host proved. */
export type SyntheticNativeSources = "registry" | "list-command" | "list-command-with-settings";

/** The shared settings file a synthetic tool declares its catalogues in. */
export const settingsFile = (id: string) => `.${id}/settings.json`;

function sourcedActivation(id: string, sources: SyntheticNativeSources) {
  if (sources === "registry") return registryHost(id);
  const listed = { ...installingHost(id), ...listedHost(id) };
  if (sources === "list-command") return listed;
  return { ...listed, updateVerb: "update", sourceCheckVerb: "update" };
}

function sourcedSettings(
  id: string,
  sources: SyntheticNativeSources
): MarketplaceSettings | undefined {
  if (sources === "list-command") return undefined;
  const registry = sources === "registry";
  return {
    settingsPath: settingsFile(id),
    settingsKey: "extraKnownMarketplaces",
    marketplacesSettingsPath: registry ? `.${id}/settings.local.json` : null,
    enabledPluginsKey: "enabledPlugins",
    declarativePluginActivationRequiresNativeProof: !registry,
    toEntryKey: sharedMarketplaceKey,
  };
}

/** What a sourced synthetic tool takes beyond what its kind of host answers. */
interface SourcedParts extends NativeToolParts {
  readonly native?: Partial<NativeActivationSpec>;
}

/** A synthetic native tool whose host answers the way its kind says. */
export function syntheticSourcedTool(
  id: string,
  sources: SyntheticNativeSources,
  parts: SourcedParts = {}
) {
  return syntheticNativeTool(
    id,
    { ...sourcedActivation(id, sources), ...parts.native },
    { marketplace: sourcedSettings(id, sources), ...parts }
  );
}

/** A catalog listing several synthetic native tools, each with the way its host answers. */
export function syntheticNativeCatalogOf(
  ...tools: ReadonlyArray<readonly [id: string, sources: SyntheticNativeSources]>
): RegisteredCatalog {
  return catalogOf(tools.map(([id, sources]) => syntheticSourcedTool(id, sources)));
}

/** A catalog listing one synthetic AI tool under the given id, driven through its own host CLI
 * the way a native tool is: for a test of the native activation flow that names no real tool. */
export function syntheticNativeCatalog(
  id: string,
  sources: SyntheticNativeSources = "registry"
): RegisteredCatalog {
  return syntheticNativeCatalogOf([id, sources]);
}
