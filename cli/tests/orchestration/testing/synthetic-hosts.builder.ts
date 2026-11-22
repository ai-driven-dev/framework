import { join } from "node:path";
import { nativeRegistrationsOf } from "../../../src/composition/host-registration.js";
import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import { MCP_CONFIG_REF } from "../../../src/contexts/tools/contract/config-refs.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { declareHooks } from "../../../src/contexts/tools/domain/formats/hooks/declaration.js";
import { projectHooksSupport } from "../../../src/contexts/tools/domain/formats/hooks/routes.js";
import { toTypedMcpSection } from "../../../src/contexts/tools/domain/formats/typed-mcp-section.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import {
  flatGlobalFilePath,
  flatPlacement,
  nativeLayout,
} from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../../src/contexts/tools/domain/sections/manifest-section.js";
import { McpConfigPart } from "../../../src/contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../../src/contexts/tools/domain/sections/models-section.js";
import { flatArtifactLayout } from "../../../src/shared/domain/materialization/flat-paths.js";
import { anEmptyContract } from "../../shared/testing/empty-build-contract.builder.js";
import { syntheticNativeTool } from "../../shared/testing/synthetic-tool-id.builder.js";
import type { HostIds } from "./clean-project.builder.js";

/** What a host keeps in its home directory: the root every host path below is derived from. */
const homeDir =
  (id: string, ...parts: string[]) =>
  (home: string) =>
    join(home, `.${id}`, ...parts);

/** The environment variable that moves the claude host's user settings directory. */
export const HOST_CONFIG_DIR_ENV = "HOSTCLAUDE_CONFIG_DIR";

/** The machine-local settings file the claude host registers marketplaces in. */
export const HOST_LOCAL_SETTINGS = ".hostclaude/settings.local.json";

const claude = syntheticNativeTool(
  "hostclaude",
  {
    scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
    userRemoveArgs: [],
    enableVerb: "install",
    disableVerb: "uninstall",
    upgradeVerb: "update",
    pluginArgs: ["--yes"],
    marketplaceRegistry: {
      location: homeDir("hostclaude", "plugins", "known_marketplaces.json"),
      layout: "install-locations-by-name",
    },
    marketplaceSources: { from: "marketplace-registry" },
    pluginRegistry: {
      location: homeDir("hostclaude", "plugins", "installed_plugins.json"),
      layout: "plugin-entries-by-scope",
    },
    userSettingsPath: (home, env) =>
      join(env(HOST_CONFIG_DIR_ENV) || join(home, ".hostclaude"), "settings.json"),
  },
  {
    marketplaceSettings: {
      settingsPath: ".hostclaude/settings.json",
      settingsKey: "extraKnownMarketplaces",
      marketplacesSettingsPath: HOST_LOCAL_SETTINGS,
      enabledPluginsKey: "enabledPlugins",
      toEntryKey: ({ name }) => name,
    },
  },
  new ModelsSection({
    providers: ["anthropic"],
    main: { settingsFile: "settings.json", effortKey: "effortLevel" },
  })
);
const codex = syntheticNativeTool("hostcodex", {
  pluginRegistry: { location: homeDir("hostcodex", "config.toml"), layout: "toml-plugin-tables" },
  marketplaceSources: {
    from: "list-command",
    args: ["plugin", "marketplace", "list", "--json"],
    layout: "marketplaces-with-source",
    hostLabel: "Host",
    unavailableMessage: "marketplace list --json unavailable; inspect the host CLI and retry",
    unverifiedMessage: "marketplace list --json output shape is not verified",
  },
});
const copilot = syntheticNativeTool("hostcopilot", {
  pluginCacheDir: undefined,
  enableVerb: "install",
  disableVerb: "uninstall",
  upgradeVerb: "update",
  updateVerb: "update",
  sourceCheckVerb: "update",
  forceRemoveArgs: ["--force"],
  uninstallLeavesRefDisabled: true,
  pluginRegistry: {
    location: homeDir("hostcopilot", "settings.json"),
    layout: "enabled-plugins-map",
  },
  marketplaceSources: {
    from: "list-command",
    args: ["plugin", "marketplace", "list", "--json"],
    layout: "name-source-rows",
    hostLabel: "Host",
    unavailableMessage:
      "marketplace list --json unavailable; upgrade to a supported binary and retry",
    unverifiedMessage: "marketplace list --json output shape is not verified",
  },
});
/** The user plugins directory the cursor host declares, for a given home. */
export const hostUserPluginsDir = homeDir("hostcursor", "plugins", "local");

/** The project hooks file the cursor host merges plugin hooks into. */
export const HOST_HOOKS_FILE = ".hostcursor/hooks.json";

const cursorHooks = declareHooks(
  { toolId: "hostcursor", directory: ".hostcursor/", adapter: 'const HOST = "unstamped";' },
  {
    undeclaredEvents: "skipped",
    events: { PreToolUse: "preToolUse" },
    rootToken: "<HOST_PLUGIN_ROOT>",
    manifestNamesHooks: true,
    file: { wrapper: { version: 1 }, entries: { shape: "flat", fieldsKept: ["command"] } },
    flat: { scriptsDir: ".hostcursor/hooks/", sharedFile: HOST_HOOKS_FILE },
    project: {
      pluginFile: "hooks.json",
      sharedFile: HOST_HOOKS_FILE,
      scriptsDir: ".hostcursor/hooks/",
    },
  }
);

/** The project hooks declaration of the cursor host: where its shared file and scripts live. */
export const hostProjectHooks = cursorHooks.project;

/** Drives no native CLI: its plugins are files under a user plugins directory. */
const cursor = defineAiTool({
  toolId: "hostcursor",
  distributionProbes: { manifest: [], marketplace: [] },
  directory: ".hostcursor/",
  toolSuffix: ".hostcursor.md",
  signalDir: null,
  displayName: "hostcursor",
  hooks: cursorHooks,
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({
    layout: nativeLayout({
      pluginsDir: "",
      installScope: "user",
      userPluginsDir: hostUserPluginsDir,
    }),
    manifest: manifestSection({ manifestRelativePath: null, pluginRootToken: "." }),
    hooks: { delivery: projectHooksSupport(cursorHooks) },
    models: new ModelsSection({ providers: ["anthropic"] }),
  }),
  linkSyntax: [],
});

/** The directory the mcp host reads its machine-wide settings from. */
export const hostMcpGlobalDir = (home: string) => join(home, ".config", "hostmcp");

/** The JSON schema URL heading a settings file aidd creates for the mcp host. */
export const HOST_MCP_SCHEMA = "https://hostmcp.invalid/config.json";

/** The file the mcp host keeps its servers in. */
export const HOST_MCP_FILE = "hostmcp.json";

/** A flat tool whose only surface is an MCP servers file the framework primes. */
const mcp = defineAiTool({
  toolId: "hostmcp",
  distributionProbes: { manifest: [], marketplace: [] },
  directory: ".hostmcp/",
  toolSuffix: ".hostmcp.md",
  signalDir: null,
  displayName: "hostmcp",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({
    layout: flatPlacement({
      artifacts: flatArtifactLayout(".hostmcp/", { skills: "nested", agent: { ext: ".md" } }),
      namespacePrefix: "aidd-",
      globalFiles: { dir: hostMcpGlobalDir, map: flatGlobalFilePath(".hostmcp/") },
    }),
    models: new ModelsSection({
      providers: ["openai", "anthropic", "mistral"],
      providerPrefix: true,
      main: { settingsFile: "hostmcp.jsonc", schema: HOST_MCP_SCHEMA },
    }),
    hooks: { delivery: { kind: "none", reason: "carries no hooks" } },
    mcp: {
      config: new McpConfigPart({
        outputPath: HOST_MCP_FILE,
        format: "json",
        mergeStrategy: "framework-prime",
        transformContent: toTypedMcpSection,
        consumes: [MCP_CONFIG_REF],
      }),
    },
  }),
  linkSyntax: [],
});

const HOST_TOOLS = { claude, codex, copilot, cursor, mcp };

/** Four distinct synthetic tools standing where a clean test names a host: each keeps the role
 * its key states, none is a registered tool. */
export const HOST: HostIds & { readonly mcp: HostIds["claude"] } = {
  claude: claude.toolId,
  codex: codex.toolId,
  copilot: copilot.toolId,
  cursor: cursor.toolId,
  mcp: mcp.toolId,
};

export function hostCatalog(): ToolCatalog {
  return new RegisteredToolCatalog(Object.values(HOST_TOOLS));
}

/** The plugin cache root a host's own profile declares, for a given home. */
export function hostCacheRoot(key: keyof HostIds, home: string): string {
  const root = hostCatalog().aiProfile(HOST[key]).nativeActivation()?.pluginCacheRoot(home);
  if (root === undefined) throw new Error(`${key} declares no plugin cache`);
  return root;
}

/** The native activations the four hosts declare, as host-registration wiring reads them. */
export function hostRegistrations() {
  return nativeRegistrationsOf(Object.values(HOST_TOOLS));
}
