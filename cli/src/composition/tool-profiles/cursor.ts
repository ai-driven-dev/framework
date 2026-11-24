import cursorSettings from "../../../assets/configs/cursor/settings.json" with { type: "json" };
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-cursor.cjs";
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import { buildCursorFlatContract } from "../../contexts/tools/domain/behaviours/cursor/cursor-flat-build.model.js";
import { agentFrontmatterOf } from "../../contexts/tools/domain/formats/agents/agent-format.js";
import {
  aiddCommandsUnder,
  convertCommandFrontmatter,
} from "../../contexts/tools/domain/formats/command.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
import {
  nativeHooksSupport,
  projectHooksSupport,
} from "../../contexts/tools/domain/formats/hooks/routes.js";
import { pluginTreeContract } from "../../contexts/tools/domain/formats/plugin-tree-contract.js";
import { asMdc, globsScopedRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
import { nativeLayout } from "../../contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../contexts/tools/domain/sections/manifest-section.js";
import {
  acceptedPluginMcp,
  McpConfigPart,
} from "../../contexts/tools/domain/sections/mcp-section.js";
import { ModelsSection } from "../../contexts/tools/domain/sections/models-section.js";
import type { AgentMarkdown } from "../../shared/domain/materialization/build-contract.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

/** Cursor has no effort key: it reads `model[effort=<level>]`. */
const AGENT_FRONTMATTER = agentFrontmatterOf({
  keep: ["name", "description", "model"],
  effortInModel: { open: "[effort=", close: "]" },
});

const PLUGIN_MCP = acceptedPluginMcp("mcp.json");

const CURSOR_AGENT_MARKDOWN: AgentMarkdown = {
  frontmatter: AGENT_FRONTMATTER,
  pluginPrefixedName: true,
  quote: "double",
};

// Distinct from their source-side equivalents even where the literals coincide: a change to
// either side must not collapse them.
const OUTPUT_PLUGIN_TREE = {
  manifestRelative: ".cursor-plugin/plugin.json",
  marketplaceRelative: ".cursor-plugin/marketplace.json",
  agentMarkdown: CURSOR_AGENT_MARKDOWN,
};

/** Where a flat build puts cursor's skills and agents. */
const CURSOR_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".cursor/", {
  skills: "single-level",
  agent: { ext: ".md" },
});

const DIRECTORY = ".cursor/";
const TOOL_SUFFIX = ".cursor.md";
// Split literal to avoid biome's noTemplateCurlyInString warning.
const CURSOR_PLUGIN_ROOT_TOKEN = "$" + "{CURSOR_PLUGIN_ROOT}";

const hooks = declareHooks(
  { toolId: "cursor", directory: DIRECTORY, adapter },
  {
    undeclaredEvents: "skipped",
    events: {
      SessionStart: "sessionStart",
      UserPromptSubmit: "beforeSubmitPrompt",
      PreToolUse: "preToolUse",
      PostToolUse: "postToolUse",
      Stop: "stop",
      SubagentStop: "subagentStop",
    },
    rootToken: CURSOR_PLUGIN_ROOT_TOKEN,
    manifestNamesHooks: true,
    // Headless `cursor-agent -p` fires no `stop`: Stop hooks run only in interactive sessions.
    // `timeout` is in seconds on both sides: Claude's hooks.json and Cursor's per-script option.
    file: {
      wrapper: { version: 1 },
      entries: { shape: "flat", fieldsKept: ["command", "matcher", "timeout"] },
    },
    flat: { scriptsDir: ".cursor/hooks/", sharedFile: ".cursor/hooks.json" },
    // Cursor auto-discovers mcp.json at a plugin's root but never a plugin-scope hooks.json -
    // three probes fired zero of seven events. Only a project-scope .cursor/hooks.json is ever
    // observed firing, so `plugin install` merges there.
    project: {
      pluginFile: "hooks.json",
      sharedFile: ".cursor/hooks.json",
      scriptsDir: ".cursor/hooks/",
    },
  }
);

const hooksDelivery = projectHooksSupport(hooks);
const CURSOR_ROOT_TOKEN = nativeHooksSupport(hooks).rootToken;

export const cursor = defineAiTool({
  toolId: "cursor",
  distributionProbes: {
    manifest: [".cursor-plugin/plugin.json"],
    marketplace: [".cursor-plugin/marketplace.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Cursor",
  signalDir: ".cursor/commands",
  configAssets: [
    {
      name: "settings.json",
      content: cursorSettings,
      destination: ".cursor/settings.json",
      delivery: "install",
    },
  ],
  hooks,
  buildContracts: {
    marketplace: contract(pluginTreeContract, hooks, OUTPUT_PLUGIN_TREE),
    flat: contract(buildCursorFlatContract, hooks, CURSOR_FLAT_LAYOUT, CURSOR_AGENT_MARKDOWN),
  },

  capabilities: {
    agents: {
      format: "markdown",
      frontmatter: AGENT_FRONTMATTER,
      // Cursor keeps single quotes as part of the value, so `'name'` would be the agent's name.
      quote: "double",
    },
    skills: {},
    commands: {
      buildInstallPath: aiddCommandsUnder(DIRECTORY),
      convertFrontmatter: convertCommandFrontmatter,
    },
    rules: {
      buildInstallPath: asMdc(installUnder(DIRECTORY, TOOL_SUFFIX, "rules/")),
      convertFrontmatter: globsScopedRule,
    },
    mcp: {
      config: new McpConfigPart({
        outputPath: `${DIRECTORY}mcp.json`,
        format: "json",
        consumes: [MCP_CONFIG_REF],
      }),
      plugin: PLUGIN_MCP,
    },
    hooks: { delivery: hooksDelivery },
    layout: nativeLayout({
      // Empty so the translator computes pluginRoot as `<pluginName>/`, giving base-relative
      // keys such as "aidd-context/commands/foo.md".
      pluginsDir: "",
      installScope: "user",
      userPluginsDir: "{home}/.cursor/plugins/local",
    }),
    manifest: manifestSection({
      manifestRelativePath: null,
      pluginRootToken: CURSOR_ROOT_TOKEN,
    }),
    models: new ModelsSection({ providers: ["anthropic"] }),
  },

  linkSyntax: [
    { from: /(@?)\.cursor\/commands\/(\d+)[_-][^/]+\/(?=\S)/g, to: "$1.cursor/commands/aidd/$2/" },
    { from: /(@\.cursor\/rules\/[^\s]+)\.md\b/g, to: "$1.mdc" },
  ],
});
