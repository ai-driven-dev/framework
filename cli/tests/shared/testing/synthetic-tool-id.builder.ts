import { join } from "node:path";
import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { NativeActivationSpec } from "../../../src/contexts/tools/contract/native-registration-spec.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
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

function syntheticConfig(name: string, providers: readonly string[] = []) {
  return defineAiTool({
    toolId: name,
    directory: `.${name}/`,
    toolSuffix: `.${name}.md`,
    signalDir: null,
    displayName: name,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () =>
      providers.length === 0 ? {} : { models: new ModelsSection({ providers }) },
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

const IDE_CONFIG = defineIdeTool({
  toolId: "syntheticide",
  directory: IDE_DIRECTORY,
  signalDir: null,
  capabilities: () => ({
    config: IDE_FILES.map(
      (file) =>
        new ConfigSection({ outputPath: `${IDE_DIRECTORY}${file.name}`, mergeStrategy: file.merge })
    ),
  }),
  configAssets: IDE_FILES.map((file) => ({
    name: file.name,
    content: file.content,
    destination: `${IDE_DIRECTORY}${file.name}`,
    delivery: "section" as const,
  })),
});

/** An IDE tool id no registry lists, for a test that tells the two categories apart. */
export const SYNTHETIC_IDE_TOOL = IDE_CONFIG.toolId;

/** The synthetic IDE tool and both AI tools, the first running the agents on anthropic and the
 * second on openai: for a test that reads both categories or the providers the tools run. */
export function syntheticMixedCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([
    syntheticConfig(SYNTHETIC_TOOL, ["anthropic"]),
    syntheticConfig(SECOND_SYNTHETIC_TOOL, ["openai"]),
    IDE_CONFIG,
  ]);
}

/** A catalog listing only the synthetic tools: what a generic test hands code that asks its tools. */
export function syntheticCatalog(): ToolCatalog {
  return new RegisteredToolCatalog(CONFIGS);
}

/** What a host keeps under its own home directory, the root every host path derives from. */
export const homeDir =
  (id: string, ...parts: string[]) =>
  (home: string) =>
    join(home, `.${id}`, ...parts);

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
    ...installingHost(id),
    scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
    marketplaceSources: { from: "marketplace-registry" },
    marketplaceRegistry: {
      location: homeDir(id, "plugins", "known_marketplaces.json"),
      layout: "install-locations-by-name",
    },
  };
}

/** What a synthetic native tool takes beyond its host verbs: layout fields, models and its catalogue file. */
interface NativeToolParts {
  readonly layout?: Partial<NativeLayoutParams>;
  readonly models?: ModelsSection;
  readonly catalogue?: string;
}

/** One synthetic AI tool driven through its own host CLI the way a native tool is. */
export function syntheticNativeTool(
  id: string,
  native: Partial<NativeActivationSpec> = {},
  parts: NativeToolParts = {}
) {
  return defineAiTool({
    toolId: id,
    distributionProbes: {
      manifest: [".plugin/plugin.json"],
      marketplace: [parts.catalogue ?? ".plugin/marketplace.json"],
    },
    directory: `.${id}/`,
    toolSuffix: `.${id}.md`,
    signalDir: null,
    displayName: id,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () => ({
      layout: nativeLayout({
        pluginsDir: `.${id}/plugins/`,
        nativeActivation: {
          binary: id,
          upgradeVerb: "upgrade",
          enableVerb: "add",
          disableVerb: "remove",
          pluginCacheDir: homeDir(id, "plugins", "cache"),
          ...native,
        },
        ...parts.layout,
      }),
      manifest: manifestSection({ manifestRelativePath: "plugin.json", pluginRootToken: "." }),
      hooks: { delivery: { kind: "plugin-file" } },
      ...(parts.models === undefined ? {} : { models: parts.models }),
    }),
    linkSyntax: [],
  });
}

/** How the synthetic host answers which marketplaces it knows: from a registry file it keeps
 * and a settings file the project carries, from a list its own command prints, or from that
 * list plus a shared settings file that only declares plugins the host proved. */
export type SyntheticNativeSources = "registry" | "list-command" | "list-command-with-settings";

function settingsFile(name: string): string {
  return `.${name}/settings.json`;
}

function sourcedActivation(id: string, sources: SyntheticNativeSources) {
  if (sources === "registry") return registryHost(id);
  const listed = { ...installingHost(id), ...listedHost(id) };
  if (sources === "list-command") return listed;
  return { ...listed, updateVerb: "update", sourceCheckVerb: "update" };
}

function sourcedSettings(id: string, sources: SyntheticNativeSources): Partial<NativeLayoutParams> {
  if (sources === "list-command") return {};
  const registry = sources === "registry";
  return {
    marketplaceSettings: {
      settingsPath: settingsFile(id),
      settingsKey: "extraKnownMarketplaces",
      marketplacesSettingsPath: registry ? `.${id}/settings.local.json` : null,
      enabledPluginsKey: "enabledPlugins",
      declarativePluginActivationRequiresNativeProof: !registry,
      toEntryKey: sharedMarketplaceKey,
    },
  };
}

function syntheticSourcedTool(id: string, sources: SyntheticNativeSources, catalogue?: string) {
  return syntheticNativeTool(id, sourcedActivation(id, sources), {
    layout: sourcedSettings(id, sources),
    catalogue,
  });
}

/** A catalog listing several synthetic native tools, each with the way its host answers. */
export function syntheticNativeCatalogOf(
  ...tools: ReadonlyArray<readonly [id: string, sources: SyntheticNativeSources]>
): ToolCatalog {
  return new RegisteredToolCatalog(tools.map(([id, sources]) => syntheticSourcedTool(id, sources)));
}

/** A catalog listing one synthetic AI tool under the given id, driven through its own host CLI
 * the way a native tool is: for a test of the native activation flow that names no real tool. */
export function syntheticNativeCatalog(
  id: string,
  sources: SyntheticNativeSources = "registry"
): ToolCatalog {
  return syntheticNativeCatalogOf([id, sources]);
}

const NATIVE_CATALOGUE = ".claude-plugin/marketplace.json";
const LISTED_CATALOGUE = ".agents/plugins/marketplace.json";
const PROVEN_CATALOGUE = ".plugin/marketplace.json";

const NATIVE_CONFIGS = [
  syntheticSourcedTool("syntheticnative", "registry", NATIVE_CATALOGUE),
  syntheticSourcedTool("syntheticlisted", "list-command", LISTED_CATALOGUE),
  syntheticSourcedTool("syntheticproven", "list-command-with-settings", PROVEN_CATALOGUE),
] as const;

/** A native tool no registry lists: its host keeps catalogue sources in a registry file and its
 * settings file takes the plugins it enables without proof. */
export const SYNTHETIC_NATIVE_TOOL = NATIVE_CONFIGS[0].toolId;
/** A native tool whose host lists catalogue sources by command and keeps no shared settings file. */
export const SYNTHETIC_LISTED_TOOL = NATIVE_CONFIGS[1].toolId;
/** A native tool whose host lists catalogue sources by command, updates a plugin itself, and whose
 * settings file takes a plugin only once the host proved it. */
export const SYNTHETIC_PROVEN_TOOL = NATIVE_CONFIGS[2].toolId;
/** The shared settings file the first synthetic native tool declares its catalogues in. */
export const SYNTHETIC_NATIVE_SETTINGS = settingsFile(SYNTHETIC_NATIVE_TOOL);
/** The shared settings file the proof-requiring synthetic tool declares its catalogues in. */
export const SYNTHETIC_PROVEN_SETTINGS = settingsFile(SYNTHETIC_PROVEN_TOOL);
/** Where each synthetic native tool's build leaves its catalogue, under the built tree. */
export const SYNTHETIC_NATIVE_CATALOGUE = NATIVE_CATALOGUE;
export const SYNTHETIC_LISTED_CATALOGUE = LISTED_CATALOGUE;
export const SYNTHETIC_PROVEN_CATALOGUE = PROVEN_CATALOGUE;

/** The synthetic native tools and the synthetic IDE tool: what a generic sync test hands code that drives hosts. */
export function syntheticSyncCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([...NATIVE_CONFIGS, IDE_CONFIG]);
}
