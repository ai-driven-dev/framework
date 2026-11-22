import { join } from "node:path";
import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import { MCP_CONFIG_REF } from "../../../src/contexts/tools/contract/config-refs.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { declareHooks } from "../../../src/contexts/tools/domain/formats/hooks/declaration.js";
import { projectHooksSupport } from "../../../src/contexts/tools/domain/formats/hooks/routes.js";
import { toTypedMcpSection } from "../../../src/contexts/tools/domain/formats/typed-mcp-section.js";
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
import {
  homeDir,
  SYNTHETIC_IDE_CONFIG,
  settingsFile,
  syntheticMixedConfigs,
  syntheticNativeTool,
  syntheticSourcedTool,
} from "./synthetic-tool-id.builder.js";

const NAME = "syntheticnative";
const ROOT_TOKEN = "$" + "{SYNTHETICNATIVE_PLUGIN_ROOT}";

/** Where the native tool keeps its own marketplace registry, under a home directory. */
export const SYNTHETIC_NATIVE_MARKETPLACE_REGISTRY = homeDir(
  NAME,
  "plugins",
  "known_marketplaces.json"
);

/** Where the native tool keeps its own plugin registry, under a home directory. */
export const SYNTHETIC_NATIVE_PLUGIN_REGISTRY = homeDir(NAME, "plugins", "installed_plugins.json");

/** The project file the native tool registers marketplaces and enables plugins in. */
export const SYNTHETIC_NATIVE_SETTINGS = settingsFile(NAME);

/** The catalogue and manifest files a plugin of the native tool ships: the open plugin format the
 * shared plugin fixtures are written in. */
export const SYNTHETIC_NATIVE_MARKETPLACE_FILE = ".claude-plugin/marketplace.json";
export const SYNTHETIC_NATIVE_MANIFEST_FILE = ".claude-plugin/plugin.json";

/** A native tool whose CLI can update one installed plugin: with no marketplace registry, it learns
 * a marketplace's source only by asking its own CLI. */
const UPDATING_ONLY = {
  updateVerb: "update",
  sourceCheckVerb: "update",
  marketplaceRegistry: undefined,
  marketplaceSources: {
    from: "list-command",
    args: ["marketplace", "list", "--json"],
    layout: "name-source-rows",
    hostLabel: "Synthetic",
    unavailableMessage: "marketplace list unavailable",
    unverifiedMessage: "marketplace list shape not verified",
  },
} as const;

function nativeConfig(toolId: string, updating: boolean) {
  return syntheticSourcedTool(toolId, "registry", {
    catalogue: SYNTHETIC_NATIVE_MARKETPLACE_FILE,
    rootToken: ROOT_TOKEN,
    manifestFile: SYNTHETIC_NATIVE_MANIFEST_FILE,
    buildsMarketplace: true,
    models: new ModelsSection({ providers: ["anthropic"] }),
    native: {
      userRemoveArgs: [],
      pluginArgs: ["--yes"],
      userSettingsPath: homeDir(NAME, "settings.json"),
      ...(updating ? UPDATING_ONLY : {}),
    },
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

/** Where the listing and the proof-requiring synthetic tools' builds leave their catalogue. */
export const SYNTHETIC_LISTED_CATALOGUE = ".agents/plugins/marketplace.json";
export const SYNTHETIC_PROVEN_CATALOGUE = ".plugin/marketplace.json";

const LISTED_CONFIG = syntheticSourcedTool("syntheticlisted", "list-command", {
  catalogue: SYNTHETIC_LISTED_CATALOGUE,
});
const PROVEN_CONFIG = syntheticSourcedTool("syntheticproven", "list-command-with-settings", {
  catalogue: SYNTHETIC_PROVEN_CATALOGUE,
});

/** A native tool whose host lists catalogue sources by command and keeps no shared settings file. */
export const SYNTHETIC_LISTED_TOOL = LISTED_CONFIG.toolId;
/** A native tool whose host lists catalogue sources by command, updates a plugin itself, and whose
 * settings file takes a plugin only once the host proved it. */
export const SYNTHETIC_PROVEN_TOOL = PROVEN_CONFIG.toolId;
/** The shared settings file the proof-requiring synthetic tool declares its catalogues in. */
export const SYNTHETIC_PROVEN_SETTINGS = settingsFile(SYNTHETIC_PROVEN_TOOL);
const ACTIVATED_NAME = "syntheticactivated";

/** The settings file the activated native tool keeps under a home directory. */
export const syntheticActivatedSettingsFile = homeDir(ACTIVATED_NAME, "settings.json");

/** The profile of a native tool whose own CLI activates plugins at user scope and nothing else:
 * for a catalog of a test that reads its activation. */
export const ACTIVATED_SYNTHETIC_CONFIG = syntheticNativeTool(ACTIVATED_NAME, {
  enableVerb: "install",
  disableVerb: "uninstall",
  userSettingsPath: syntheticActivatedSettingsFile,
});

/** An AI tool id no registry lists, whose plugins its own CLI activates at user scope. */
export const ACTIVATED_SYNTHETIC_TOOL = ACTIVATED_SYNTHETIC_CONFIG.toolId;

/** The synthetic native tools and the synthetic IDE tool: what a generic sync test hands code that drives hosts. */
export function syntheticSyncCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([
    NATIVE_CONFIG,
    LISTED_CONFIG,
    PROVEN_CONFIG,
    SYNTHETIC_IDE_CONFIG,
  ]);
}

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
export function syntheticNativeFamilyCatalog(): ToolCatalog {
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
