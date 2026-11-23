import claudeSettings from "../../../assets/configs/claude/settings.json" with { type: "json" };
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-claude.cjs";
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import { buildClaudeFlatContract } from "../../contexts/tools/domain/behaviours/claude/claude-flat-build.model.js";
import { agentFrontmatterOf } from "../../contexts/tools/domain/formats/agents/agent-format.js";
import {
  convertCommandFrontmatter,
  phasedCommandsLink,
  phasedCommandsUnder,
} from "../../contexts/tools/domain/formats/command.js";
import {
  declareHooks,
  ownNameEvents,
} from "../../contexts/tools/domain/formats/hooks/declaration.js";
import { nativeHooksSupport } from "../../contexts/tools/domain/formats/hooks/routes.js";
import { pluginTreeContract } from "../../contexts/tools/domain/formats/plugin-tree-contract.js";
import { pathsScopedRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { sharedMarketplaceKey } from "../../contexts/tools/domain/marketplace-entry.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { everyProject } from "../../contexts/tools/domain/profile/recommendation.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
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
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";
import { SOURCE_PLUGIN_ROOT_TOKEN } from "../../shared/domain/materialization/plugin-root-path-rewrite.js";

/** Claude Code reads its own keys; an agent without `tools` inherits every tool. */
const AGENT_FRONTMATTER = agentFrontmatterOf({ keep: ["name", "description", "model", "effort"] });

const PLUGIN_MCP = acceptedPluginMcp();

/** Build output paths, deliberately distinct from the source-side constants even where the
 * literal values coincide: a change to either side must not collapse them. */
const OUTPUT_PLUGIN_TREE: Parameters<typeof pluginTreeContract>[1] = {
  manifestRelative: ".claude-plugin/plugin.json",
  marketplaceRelative: ".claude-plugin/marketplace.json",
  agentMarkdown: { frontmatter: AGENT_FRONTMATTER },
};

/** Where a flat build puts claude's skills and agents. */
const CLAUDE_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".claude/", {
  skills: "single-level",
  agent: { ext: ".md" },
});

const DIRECTORY = ".claude/";
const TOOL_SUFFIX = ".claude.md";

const hooks = declareHooks(
  { toolId: "claude", directory: DIRECTORY, adapter },
  {
    // Claude subscribes every event under its own name, SubagentStop included.
    events: ownNameEvents(),
    rootToken: SOURCE_PLUGIN_ROOT_TOKEN,
    // Claude Code loads ./hooks/hooks.json by its own convention and rejects the plugin outright
    // when a manifest names it too: "Duplicate hooks file detected". The hooks fired anyway, so
    // the plugin read as failed while working.
    manifestNamesHooks: false,
    // `.claude/settings.json` holds every other setting beside `hooks`; Claude runs prompt,
    // agent and http hooks too, so every group and item is kept as shipped.
    file: { wrapper: {}, entries: { shape: "matchers", itemsKept: "all" } },
    flat: { scriptsDir: ".claude/hooks/", sharedFile: ".claude/settings.json" },
  }
);

const hooksSupport = nativeHooksSupport(hooks);

// Claude registers its own marketplaces and enables its own plugins, both driven here.
// At project scope the command rewrites `.claude/settings.json` after this CLI hashed
// it: two writers, one recorder, and `status` reporting drift forever. `--scope local`
// writes `.claude/settings.local.json` instead, a file this CLI neither writes nor
// tracks, which is what makes the verbs below safe to declare.
const CLAUDE_ACTIVATION: NativeLayoutParams["nativeActivation"] = {
  binary: "claude",
  scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
  userRemoveArgs: [],
  enableVerb: "install",
  disableVerb: "uninstall",
  upgradeVerb: "update",
  // `--yes` gates a prune confirmation these calls never request, but a headless
  // stdin has no terminal to answer any prompt at all.
  pluginArgs: ["--yes"],
  // Root of claude's own marketplace registry, read by the sync guard that refuses a
  // name-stealing re-add before driving `marketplace add` at all. Declared here alone,
  // which is what keeps that guard claude-only by declaration.
  marketplaceRegistry: {
    location: "{home}/.claude/plugins/known_marketplaces.json",
    layout: "install-locations-by-name",
  },
  marketplaceSources: { from: "marketplace-registry" },
  // Claude's own plugin registry, read by `doctor`: one entry per scope a ref was
  // installed at, an entry installed at a project scope also naming its project.
  pluginRegistry: {
    location: "{home}/.claude/plugins/installed_plugins.json",
    layout: "plugin-entries-by-scope",
  },
  // Root of claude's own plugin cache. `clean` composes `<root>/<hostName>` and purges
  // only once a fresh read of `marketplaceRegistry` above no longer names it: claude
  // marks an orphaned tree `.orphaned_at` but never deletes it itself.
  pluginCacheDir: "{home}/.claude/plugins/cache",
  // Where a `--scope user` install or marketplace add lands, measured against the real
  // binary, under `CLAUDE_CONFIG_DIR` when set. aidd writes the main session's model
  // there, nothing else.
  userSettingsPath: {
    env: "CLAUDE_CONFIG_DIR",
    fallback: "{home}/.claude",
    fileName: "settings.json",
  },
};

const CLAUDE_MARKETPLACE_SETTINGS: NativeLayoutParams["marketplaceSettings"] = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  // The registered marketplace is the tree this CLI builds under `.aidd/cache/`, named
  // by absolute path, so the entry describes one machine and must not be committed. It
  // is the file `claude plugin marketplace add --scope local` writes itself.
  marketplacesSettingsPath: ".claude/settings.local.json",
  enabledPluginsKey: "enabledPlugins",
  toEntryKey: sharedMarketplaceKey,
};

/** A command filed under a numbered phase folder lands in that phase's commands folder. */
export const claude = defineAiTool({
  toolId: "claude",
  distributionProbes: {
    manifest: [".claude-plugin/plugin.json"],
    marketplace: [".claude-plugin/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Claude Code",
  recommendedFor: everyProject,
  signalDir: ".claude/commands",
  configAssets: [
    {
      name: "settings.json",
      content: claudeSettings,
      destination: ".claude/settings.json",
      delivery: "install",
    },
  ],
  hooks,
  buildContracts: {
    marketplace: contract(pluginTreeContract, hooks, OUTPUT_PLUGIN_TREE),
    flat: contract(buildClaudeFlatContract, hooks, CLAUDE_FLAT_LAYOUT, AGENT_FRONTMATTER),
  },

  capabilities: {
    agents: {
      format: "markdown",
      frontmatter: AGENT_FRONTMATTER,
    },
    skills: {},
    commands: {
      buildInstallPath: phasedCommandsUnder(
        DIRECTORY,
        installUnder(DIRECTORY, TOOL_SUFFIX, "commands/")
      ),
      convertFrontmatter: convertCommandFrontmatter,
    },
    rules: {
      buildInstallPath: installUnder(DIRECTORY, TOOL_SUFFIX, "rules/"),
      convertFrontmatter: pathsScopedRule,
    },
    mcp: {
      config: new McpConfigPart({
        outputPath: ".mcp.json",
        format: "json",
        consumes: [MCP_CONFIG_REF],
      }),
      plugin: PLUGIN_MCP,
    },
    hooks: { delivery: hooksSupport.delivery },
    layout: nativeLayout({
      pluginsDir: ".claude/plugins/",
      nativeActivation: CLAUDE_ACTIVATION,
      marketplaceSettings: CLAUDE_MARKETPLACE_SETTINGS,
    }),
    manifest: manifestSection({
      manifestRelativePath: "plugin.json",
      pluginRootToken: hooksSupport.rootToken,
    }),
    // Its main session reads the model from the user settings file `nativeActivation` names.
    models: new ModelsSection({
      providers: ["anthropic"],
      main: { settingsFile: "settings.json", effortKey: "effortLevel" },
    }),
  },

  linkSyntax: [
    {
      from: /(@?)\.claude\/commands\/(\d+)[_][^/]+\//g,
      to: phasedCommandsLink(DIRECTORY),
    },
  ],
});
