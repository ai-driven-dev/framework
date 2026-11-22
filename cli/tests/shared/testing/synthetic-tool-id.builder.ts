import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type {
  MarketplaceSettings,
  NativeActivationSpec,
} from "../../../src/contexts/tools/contract/native-registration-spec.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { sharedMarketplaceKey } from "../../../src/contexts/tools/domain/marketplace-entry.js";
import {
  defineAiTool,
  defineIdeTool,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { nativeLayout } from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../../src/contexts/tools/domain/sections/manifest-section.js";
import { ModelsSection } from "../../../src/contexts/tools/domain/sections/models-section.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

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
  });
}

const CONFIGS = [syntheticConfig("synthetic"), syntheticConfig("syntheticb")] as const;

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = CONFIGS[0].toolId;
/** A second tool id no registry lists, for a test that tells two tools apart. */
export const SECOND_SYNTHETIC_TOOL = CONFIGS[1].toolId;

const IDE_CONFIG = defineIdeTool({
  toolId: "syntheticide",
  directory: ".syntheticide/",
  signalDir: null,
  capabilities: () => ({}),
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

/** How a synthetic native tool's host answers. */
interface NativeHost {
  /** Where its build leaves the catalogue, under the built tree. */
  readonly catalogue: string;
  /** Whether the host keeps catalogue sources in a registry file or lists them by command. */
  readonly sources: "registry" | "list";
  /** The shared settings file declaring its catalogues, when it keeps one. */
  readonly settings?: { readonly requiresNativeProof: boolean };
  /** Whether its binary has a `plugin update` verb of its own. */
  readonly updating?: boolean;
}

function settingsFile(name: string): string {
  return `.${name}/settings.json`;
}

function sourcesOf(name: string, host: NativeHost): Partial<NativeActivationSpec> {
  if (host.sources === "registry") {
    return {
      scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
      marketplaceSources: { from: "marketplace-registry" },
      marketplaceRegistry: {
        location: (h) => `${h}/.${name}/known_marketplaces.json`,
        layout: "install-locations-by-name",
      },
    };
  }
  return {
    marketplaceSources: {
      from: "list-command",
      args: ["marketplace", "list"],
      layout: "marketplaces-with-source",
      hostLabel: name,
      unavailableMessage: `${name} marketplace list unavailable`,
      unverifiedMessage: `${name} marketplace list output shape is not verified`,
    },
  };
}

function activationOf(name: string, host: NativeHost): NativeActivationSpec {
  return {
    binary: name,
    enableVerb: "install",
    disableVerb: "uninstall",
    upgradeVerb: "update",
    ...(host.updating ? { updateVerb: "update", sourceCheckVerb: "update" } : {}),
    pluginRegistry: {
      location: (h) => `${h}/.${name}/installed_plugins.json`,
      layout: "plugin-entries-by-scope",
    },
    pluginCacheDir: (h) => `${h}/.${name}/plugins/cache`,
    ...sourcesOf(name, host),
  };
}

function settingsOf(name: string, host: NativeHost): { marketplaceSettings?: MarketplaceSettings } {
  if (host.settings === undefined) return {};
  return {
    marketplaceSettings: {
      settingsPath: settingsFile(name),
      settingsKey: "extraKnownMarketplaces",
      marketplacesSettingsPath: host.sources === "list" ? null : `.${name}/settings.local.json`,
      enabledPluginsKey: "enabledPlugins",
      declarativePluginActivationRequiresNativeProof: host.settings.requiresNativeProof,
      toEntryKey: sharedMarketplaceKey,
    },
  };
}

function syntheticNativeConfig(name: string, host: NativeHost) {
  return defineAiTool({
    toolId: name,
    distributionProbes: { manifest: [".plugin/plugin.json"], marketplace: [host.catalogue] },
    directory: `.${name}/`,
    toolSuffix: `.${name}.md`,
    signalDir: null,
    displayName: name,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () => ({
      hooks: { delivery: { kind: "none", reason: "synthetic" } },
      layout: nativeLayout({
        pluginsDir: `.${name}/plugins/`,
        nativeActivation: activationOf(name, host),
        ...settingsOf(name, host),
      }),
      manifest: manifestSection({ manifestRelativePath: "plugin.json", pluginRootToken: "ROOT" }),
    }),
    linkSyntax: [],
  });
}

const NATIVE_CATALOGUE = ".claude-plugin/marketplace.json";
const LISTED_CATALOGUE = ".agents/plugins/marketplace.json";
const PROVEN_CATALOGUE = ".plugin/marketplace.json";

const NATIVE_CONFIGS = [
  syntheticNativeConfig("syntheticnative", {
    catalogue: NATIVE_CATALOGUE,
    sources: "registry",
    settings: { requiresNativeProof: false },
  }),
  syntheticNativeConfig("syntheticlisted", { catalogue: LISTED_CATALOGUE, sources: "list" }),
  syntheticNativeConfig("syntheticproven", {
    catalogue: PROVEN_CATALOGUE,
    sources: "list",
    settings: { requiresNativeProof: true },
    updating: true,
  }),
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
/** Where each synthetic native tool's build leaves its catalogue, under the built tree. */
export const SYNTHETIC_NATIVE_CATALOGUE = NATIVE_CATALOGUE;
export const SYNTHETIC_LISTED_CATALOGUE = LISTED_CATALOGUE;
export const SYNTHETIC_PROVEN_CATALOGUE = PROVEN_CATALOGUE;

/** The synthetic native tools and the synthetic IDE tool: what a generic sync test hands code that drives hosts. */
export function syntheticSyncCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([...NATIVE_CONFIGS, IDE_CONFIG]);
}
