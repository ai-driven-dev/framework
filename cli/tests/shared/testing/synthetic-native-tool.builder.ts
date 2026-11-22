import { join } from "node:path";
import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import { MCP_CONFIG_REF } from "../../../src/contexts/tools/contract/config-refs.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { declareHooks } from "../../../src/contexts/tools/domain/formats/hooks/declaration.js";
import { projectHooksSupport } from "../../../src/contexts/tools/domain/formats/hooks/routes.js";
import { toTypedMcpSection } from "../../../src/contexts/tools/domain/formats/typed-mcp-section.js";
import { sharedMarketplaceKey } from "../../../src/contexts/tools/domain/marketplace-entry.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import {
  flatPlacement,
  nativeLayout,
} from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../../src/contexts/tools/domain/sections/manifest-section.js";
import { McpConfigPart } from "../../../src/contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../../src/contexts/tools/domain/sections/models-section.js";
import { flatArtifactLayout } from "../../../src/shared/domain/materialization/flat-paths.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";
import { syntheticMixedConfigs } from "./synthetic-tool-id.builder.js";

const NAME = "syntheticnative";
const HOME_DIR = `.${NAME}`;
const ROOT_TOKEN = "$" + "{SYNTHETICNATIVE_PLUGIN_ROOT}";

/** Where the native tool keeps its own marketplace registry, under a home directory. */
export const SYNTHETIC_NATIVE_MARKETPLACE_REGISTRY = (home: string) =>
  join(home, HOME_DIR, "plugins", "known_marketplaces.json");

/** Where the native tool keeps its own plugin registry, under a home directory. */
export const SYNTHETIC_NATIVE_PLUGIN_REGISTRY = (home: string) =>
  join(home, HOME_DIR, "plugins", "installed_plugins.json");

/** Where the native tool caches the plugins it installs, under a home directory. */
export const SYNTHETIC_NATIVE_PLUGIN_CACHE = (home: string) =>
  join(home, HOME_DIR, "plugins", "cache");

/** The project file the native tool registers marketplaces and enables plugins in. */
export const SYNTHETIC_NATIVE_SETTINGS = `${HOME_DIR}/settings.json`;

/** The machine-local project file the native tool registers marketplaces in. */
export const SYNTHETIC_NATIVE_LOCAL_SETTINGS = `${HOME_DIR}/settings.local.json`;

/** The catalogue and manifest files a plugin of the native tool ships: the open plugin format the
 * shared plugin fixtures are written in. */
export const SYNTHETIC_NATIVE_MARKETPLACE_FILE = ".claude-plugin/marketplace.json";
export const SYNTHETIC_NATIVE_MANIFEST_FILE = ".claude-plugin/plugin.json";

/** A native tool; the updating one holds no marketplace registry, so it learns a marketplace's source
 * only by asking its own CLI, and its CLI can update one installed plugin. */
const UPDATING_ONLY = {
  updateVerb: "update",
  sourceCheckVerb: "update",
  marketplaceSources: {
    from: "list-command",
    args: ["marketplace", "list", "--json"],
    layout: "name-source-rows",
    hostLabel: "Synthetic",
    unavailableMessage: "marketplace list unavailable",
    unverifiedMessage: "marketplace list shape not verified",
  },
} as const;

const REGISTRY_ONLY = {
  marketplaceRegistry: {
    location: SYNTHETIC_NATIVE_MARKETPLACE_REGISTRY,
    layout: "install-locations-by-name",
  },
  marketplaceSources: { from: "marketplace-registry" },
} as const;

function nativeConfig(toolId: string, updating: boolean) {
  return defineAiTool({
    toolId,
    distributionProbes: {
      manifest: [SYNTHETIC_NATIVE_MANIFEST_FILE],
      marketplace: [SYNTHETIC_NATIVE_MARKETPLACE_FILE],
    },
    directory: `${HOME_DIR}/`,
    toolSuffix: `.${NAME}.md`,
    displayName: NAME,
    signalDir: null,
    buildContracts: { marketplace: () => anEmptyContract(), flat: () => anEmptyContract() },
    capabilities: () => ({
      hooks: { delivery: { kind: "plugin-file" } },
      layout: nativeLayout({
        pluginsDir: `${HOME_DIR}/plugins/`,
        nativeActivation: {
          binary: toolId,
          scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
          userRemoveArgs: [],
          enableVerb: "install",
          disableVerb: "uninstall",
          upgradeVerb: "update",
          pluginArgs: ["--yes"],
          ...(updating ? UPDATING_ONLY : REGISTRY_ONLY),
          pluginRegistry: {
            location: SYNTHETIC_NATIVE_PLUGIN_REGISTRY,
            layout: "plugin-entries-by-scope",
          },
          pluginCacheDir: SYNTHETIC_NATIVE_PLUGIN_CACHE,
          userSettingsPath: (home) => join(home, HOME_DIR, "settings.json"),
        },
        marketplaceSettings: {
          settingsPath: SYNTHETIC_NATIVE_SETTINGS,
          settingsKey: "extraKnownMarketplaces",
          marketplacesSettingsPath: SYNTHETIC_NATIVE_LOCAL_SETTINGS,
          enabledPluginsKey: "enabledPlugins",
          toEntryKey: sharedMarketplaceKey,
        },
      }),
      manifest: manifestSection({
        manifestRelativePath: "plugin.json",
        pluginRootToken: ROOT_TOKEN,
      }),
      models: new ModelsSection({ providers: ["anthropic"] }),
    }),
    linkSyntax: [],
  });
}

const NATIVE_CONFIG = nativeConfig(NAME, false);
const UPDATING_CONFIG = nativeConfig(`${NAME}update`, true);

/** An AI tool id no registry lists, that registers marketplaces and enables plugins itself: for a
 * test whose subject is what a native-registering tool answers. */
export const SYNTHETIC_NATIVE_TOOL = NATIVE_CONFIG.toolId;

/** The native tool again, its own CLI able to update one installed plugin: for a test that tells a
 * tool that can from one that cannot. */
export const SYNTHETIC_UPDATING_NATIVE_TOOL = UPDATING_CONFIG.toolId;

const USER_NAME = "syntheticuser";

/** The directory the user-scope tool installs its plugins in, under a home directory. */
export const SYNTHETIC_USER_PLUGINS = (home: string) => join(home, `.${USER_NAME}`, "plugins");

const USER_HOOKS = declareHooks(
  { toolId: USER_NAME, directory: `.${USER_NAME}/`, adapter: `const HOST = "unstamped";` },
  {
    undeclaredEvents: "skipped",
    events: { PreToolUse: "preToolUse" },
    rootToken: ROOT_TOKEN,
    file: {
      wrapper: { version: 1 },
      entries: { shape: "flat", fieldsKept: ["command", "matcher", "timeout"] },
    },
    project: {
      pluginFile: "hooks.json",
      sharedFile: `.${USER_NAME}/hooks.json`,
      scriptsDir: `.${USER_NAME}/hooks/`,
    },
  }
);

const USER_CONFIG = defineAiTool({
  toolId: USER_NAME,
  directory: `.${USER_NAME}/`,
  toolSuffix: `.${USER_NAME}.md`,
  displayName: USER_NAME,
  signalDir: `.${USER_NAME}/commands`,
  hooks: USER_HOOKS,
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({
    hooks: { delivery: projectHooksSupport(USER_HOOKS) },
    layout: nativeLayout({
      pluginsDir: "",
      installScope: "user",
      userPluginsDir: SYNTHETIC_USER_PLUGINS,
    }),
    manifest: manifestSection({ manifestRelativePath: null, pluginRootToken: ROOT_TOKEN }),
    models: new ModelsSection({ providers: ["anthropic"] }),
  }),
  linkSyntax: [],
});

/** An AI tool id no registry lists, that installs its plugins per user, merges hooks into a project file, has no native
 * activation and shows itself in a project by an aidd-named file under `.syntheticuser/commands/`: for a test whose
 * subject is a user-scope tool. */
export const SYNTHETIC_USER_TOOL = USER_CONFIG.toolId;

/** The native and user-scope synthetic tools, the plain synthetic tools and the synthetic IDE tool. */
export function syntheticNativeCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([
    NATIVE_CONFIG,
    UPDATING_CONFIG,
    USER_CONFIG,
    MCP_CONFIG,
    ...syntheticMixedConfigs(),
  ]);
}

const MCP_NAME = "syntheticmcp";

/** The project file the flat MCP tool merges plugin MCP servers into. */
export const SYNTHETIC_MCP_FILE = `${MCP_NAME}.json`;

const MCP_CONFIG = defineAiTool({
  toolId: MCP_NAME,
  directory: `.${MCP_NAME}/`,
  toolSuffix: `.${MCP_NAME}.md`,
  displayName: MCP_NAME,
  signalDir: null,
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({
    mcp: {
      config: new McpConfigPart({
        outputPath: SYNTHETIC_MCP_FILE,
        format: "json",
        mergeStrategy: "framework-prime",
        transformContent: toTypedMcpSection,
        consumes: [MCP_CONFIG_REF],
      }),
    },
    hooks: { delivery: { kind: "none", reason: "the synthetic MCP tool runs no hooks" } },
    layout: flatPlacement({
      artifacts: flatArtifactLayout(`.${MCP_NAME}/`, { skills: "nested", agent: { ext: ".md" } }),
      namespacePrefix: "aidd-",
    }),
  }),
  linkSyntax: [],
});

/** An AI tool id no registry lists, that merges plugin MCP servers into a project file of its own: for
 * a test whose subject is what removing a plugin does to that file. */
export const SYNTHETIC_MCP_TOOL = MCP_CONFIG.toolId;
