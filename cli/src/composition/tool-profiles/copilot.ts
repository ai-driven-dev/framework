import { join } from "node:path";
import copilotVscodeSettings from "../../../assets/configs/copilot/vscode-settings.json" with {
  type: "json",
};
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-copilot.cjs";
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import { PLUGIN_ROOT_TOKEN } from "../../contexts/tools/contract/plugin-root-token.js";
import { buildCopilotMarketplaceContract } from "../../contexts/tools/domain/behaviours/copilot/copilot-build.model.js";
import {
  agentsHandler,
  COPILOT_LINK_SYNTAX,
  commandsHandler,
  DIRECTORY,
  EXT_AGENT,
  EXT_INSTRUCTIONS,
  EXT_PROMPT,
  rulesHandler,
  TOOL_SUFFIX,
} from "../../contexts/tools/domain/behaviours/copilot/copilot-content.model.js";
import { buildCopilotFlatContract } from "../../contexts/tools/domain/behaviours/copilot/copilot-flat-build.model.js";
import { agentFrontmatterOf } from "../../contexts/tools/domain/formats/agents/agent-format.js";
import { convertCommandFrontmatter } from "../../contexts/tools/domain/formats/command.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
import { nativeHooksSupport } from "../../contexts/tools/domain/formats/hooks/routes.js";
import { serversKeyed } from "../../contexts/tools/domain/formats/mcp/servers-keyed.js";
import { sharedMarketplaceKey } from "../../contexts/tools/domain/marketplace-entry.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { typescriptOrMonorepo } from "../../contexts/tools/domain/profile/recommendation.js";
import { AgentsSection } from "../../contexts/tools/domain/sections/agents-section.js";
import { CommandsSection } from "../../contexts/tools/domain/sections/commands-section.js";
import { ConfigSection } from "../../contexts/tools/domain/sections/config-section.js";
import {
  type NativeLayoutParams,
  nativeLayout,
} from "../../contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../contexts/tools/domain/sections/manifest-section.js";
import {
  acceptedPluginMcp,
  McpConfigPart,
} from "../../contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../contexts/tools/domain/sections/models-section.js";
import { RulesSection } from "../../contexts/tools/domain/sections/rules-section.js";
import { SkillsSection } from "../../contexts/tools/domain/sections/skills-section.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

/** Copilot reads `effort` as `reasoningEffort`, and gives a subagent the repository
 * instructions only when `include-custom-instructions` is set; it defaults to false. */
const AGENT_FRONTMATTER = agentFrontmatterOf({
  keep: ["name", "description", "model", "reasoningEffort", "include-custom-instructions"],
  rename: { reasoningEffort: "effort" },
  defaults: { "include-custom-instructions": true },
});

const PLUGIN_MCP = acceptedPluginMcp();

const OUTPUT_PLUGIN_TREE = {
  manifestRelative: ".plugin/plugin.json",
  marketplaceRelative: ".plugin/marketplace.json",
  agentMarkdown: { frontmatter: AGENT_FRONTMATTER },
};

/** Where a flat build puts copilot's skills and agents: `.github/agents/<plugin>-<name>.agent.md`. */
const COPILOT_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".github/", {
  skills: "single-level",
  agent: { ext: ".agent.md" },
});

const FLAT_VSCODE_MCP_PATH = ".vscode/mcp.json";

const VSCODE_SETTINGS_ASSET = "vscode-settings.json";
const VSCODE_SETTINGS_PATH = ".vscode/settings.json";

const hooks = declareHooks(
  { toolId: "copilot", directory: DIRECTORY, adapter },
  {
    manifestNamesHooks: true,
    // Copilot CLI honours the matcher, measured live: a `Write|Edit` PostToolUse entry stays
    // silent on Read.
    file: {
      wrapper: { version: 1 },
      entries: { shape: "flat", fieldsKept: ["type", "command", "matcher", "timeout"] },
    },
    // The variable Copilot expands to an installed plugin's directory in a hooks file.
    rootToken: PLUGIN_ROOT_TOKEN,
    // One file per plugin, `.github/hooks/<plugin>.hooks.json`, beside its scripts.
    flat: { scriptsDir: `${DIRECTORY}hooks/` },
  }
);

const hooksSupport = nativeHooksSupport(hooks);

// Copilot auto-installs repo-level enabledPlugins; a foreign catalogue at the same name
// must therefore never receive a declarative true entry before native source proof.
// Its registry is global to the user and keyed by name, so a name held by a project that
// no longer exists breaks every other project's installs: measured; `update` exits 1 on a
// local path that is gone and 0 otherwise, which is what lets a dead name be reclaimed with
// `--force` without ever taking one that still resolves.
const COPILOT_ACTIVATION: NativeLayoutParams["nativeActivation"] = {
  binary: "copilot",
  upgradeVerb: "update",
  updateVerb: "update",
  enableVerb: "install",
  disableVerb: "uninstall",
  sourceCheckVerb: "update",
  forceRemoveArgs: ["--force"],
  // Measured on 1.0.98: `plugin uninstall` sets the ref to `false` in enabledPlugins
  // rather than deleting it.
  uninstallLeavesRefDisabled: true,
  // Where `copilot plugin marketplace add`/`install` land, measured against the real
  // binary. Never written by aidd; named here for a diagnostic alone.
  userSettingsPath: (h) => join(h, ".copilot", "settings.json"),
  // Copilot's registry is `settings.json`, never `config.json`, whose `installedPlugins`
  // reads empty on a machine that has run installs.
  pluginRegistry: {
    location: (h) => join(h, ".copilot", "settings.json"),
    layout: "enabled-plugins-map",
  },
  // 1.0.98 answers `--json`; the installed 1.0.83 rejects it and stays unreadable.
  marketplaceSources: {
    from: "list-command",
    args: ["plugin", "marketplace", "list", "--json"],
    layout: "name-source-rows",
    hostLabel: "Copilot",
    unavailableMessage:
      "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry",
    unverifiedMessage:
      "Copilot CLI marketplace list --json output shape is not verified; upgrade to a supported binary and reconcile manually",
  },
};

// Copilot CLI and cloud agent read this repository file; enabledPlugins auto-installs.
// Keep machine-local marketplace paths out and project only proven native refs.
const COPILOT_MARKETPLACE_SETTINGS: NativeLayoutParams["marketplaceSettings"] = {
  settingsPath: ".github/copilot/settings.json",
  settingsKey: "extraKnownMarketplaces",
  marketplacesSettingsPath: null,
  enabledPluginsKey: "enabledPlugins",
  declarativePluginActivationRequiresNativeProof: true,
  toEntryKey: sharedMarketplaceKey,
};

const COPILOT_LAYOUT = nativeLayout({
  pluginsDir: ".github/plugins/",
  nativeActivation: COPILOT_ACTIVATION,
  marketplaceSettings: COPILOT_MARKETPLACE_SETTINGS,
});

const COPILOT_MCP = {
  config: new McpConfigPart({
    outputPath: ".vscode/mcp.json",
    format: "json",
    consumes: [MCP_CONFIG_REF],
    transformContent: serversKeyed,
  }),
  plugin: PLUGIN_MCP,
};

const COPILOT_VSCODE_CONFIG = new ConfigSection({
  outputPath: VSCODE_SETTINGS_PATH,
  mergeStrategy: "framework-prime",
  staticContentAssetFile: VSCODE_SETTINGS_ASSET,
  requiresTool: "vscode",
});

const COPILOT_MODELS = new ModelsSection({
  providers: ["openai", "anthropic"],
  nativeModels: {
    "claude-opus-5-5": "claude-opus-5.5",
    "claude-sonnet-5-5": "claude-sonnet-5.5",
    "claude-haiku-5-5": "claude-haiku-5.5",
  },
});

export const copilot = defineAiTool({
  toolId: "copilot",
  distributionProbes: {
    manifest: [".plugin/plugin.json", ".github/plugin/plugin.json", "plugin.json"],
    // `.github/plugin/plugin.json` is the manifest's own second-choice location, never a
    // marketplace catalog: a real build leaves one at `.plugin/marketplace.json`.
    marketplace: [".plugin/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "GitHub Copilot",
  recommendedFor: typescriptOrMonorepo,
  signalDir: ".github/prompts",
  configAssets: [
    {
      name: VSCODE_SETTINGS_ASSET,
      content: copilotVscodeSettings,
      destination: VSCODE_SETTINGS_PATH,
      delivery: "section",
    },
  ],
  hooks,
  buildContracts: {
    marketplace: () => buildCopilotMarketplaceContract(hooks, OUTPUT_PLUGIN_TREE),
    flat: () =>
      buildCopilotFlatContract(hooks, COPILOT_FLAT_LAYOUT, {
        mcpPath: FLAT_VSCODE_MCP_PATH,
        frontmatter: AGENT_FRONTMATTER,
      }),
  },

  capabilities: () => ({
    agents: new AgentsSection({
      directory: DIRECTORY,
      toolSuffix: EXT_AGENT,
      format: "markdown",
      buildInstallPath: agentsHandler.buildFilePath,
      frontmatter: AGENT_FRONTMATTER,
    }),
    skills: new SkillsSection({
      directory: DIRECTORY,
    }),
    commands: new CommandsSection({
      toolSuffix: EXT_PROMPT,
      buildInstallPath: commandsHandler.buildFilePath,
      convertFrontmatter: convertCommandFrontmatter,
    }),
    rules: new RulesSection({
      toolSuffix: EXT_INSTRUCTIONS,
      inputSuffix: TOOL_SUFFIX,
      buildInstallPath: rulesHandler.buildFilePath,
      convertFrontmatter: rulesHandler.convertFrontmatter,
    }),
    mcp: COPILOT_MCP,
    config: [COPILOT_VSCODE_CONFIG],
    hooks: { delivery: hooksSupport.delivery },
    layout: COPILOT_LAYOUT,
    manifest: manifestSection({
      manifestRelativePath: "plugin.json",
      pluginRootToken: hooksSupport.rootToken,
    }),
    models: COPILOT_MODELS,
  }),

  linkSyntax: COPILOT_LINK_SYNTAX,
});
