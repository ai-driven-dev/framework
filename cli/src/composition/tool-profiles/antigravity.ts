// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-antigravity.cjs";
import { MCP_CONFIG_REF } from "../../contexts/tools/contract/config-refs.js";
import {
  antigravityAgentFrontmatter,
  buildAntigravityFlatContract,
  buildAntigravityPluginTreeContract,
} from "../../contexts/tools/domain/behaviours/antigravity/antigravity-build.model.js";
import { antigravityHooksSection } from "../../contexts/tools/domain/behaviours/antigravity/antigravity-hooks.model.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
import { pluginFileHooksDelivery } from "../../contexts/tools/domain/formats/hooks/routes.js";
import { activationTriggersRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
import { nativeLayout } from "../../contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../contexts/tools/domain/sections/manifest-section.js";
import {
  acceptedPluginMcp,
  McpConfigPart,
} from "../../contexts/tools/domain/sections/mcp-section.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

const DIRECTORY = ".agents/";

/** Where a flat build, and a flat install, put antigravity's skills, agents and rules. A rule sits
 * directly in `.agents/rules/` and opens with a `trigger` (https://antigravity.google/docs/rules). */
const ANTIGRAVITY_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".agents/", {
  skills: "single-level",
  rules: "top-level",
  agent: { folderFile: "agent.md" },
});
const TOOL_SUFFIX = ".antigravity.md";
/** The MCP servers file `agy` reads for a project. */
const MCP_PATH = `${DIRECTORY}mcp_config.json`;

/** Each Claude tool an agent may declare, by the name `agy` gives it in a subagent's `tools`. The
 * names come from the `tools` field and its example on https://antigravity.google/docs/subagents
 * (view_file, grep_search, replace_file_content, run_command), and from a real `agy` run for
 * write_file: that page's hooks reference calls it write_to_file, which `agy` never called. A tool
 * with no name cited there, such as Glob, WebFetch or Task, is left out: an unknown name may hang
 * the subagent. */
const AGENT_TOOLS: ReadonlyMap<string, string> = new Map([
  ["Read", "view_file"],
  ["Grep", "grep_search"],
  ["Edit", "replace_file_content"],
  ["Write", "write_file"],
  ["Bash", "run_command"],
]);

/** Hook matcher names as `agy` reports them in `toolCall` (captured payloads); `agy` matches a whole
 * name as a regex, and an unmapped name is dropped. Differs from AGENT_TOOLS: a subagent's `tools`
 * takes the documented name (replace_file_content). */
const MATCHER_TOOLS: ReadonlyMap<string, string> = new Map([
  ["Write", "write_file"],
  ["Edit", "edit_file"],
  ["Bash", "run_command"],
]);

const hooks = declareHooks(
  { toolId: "antigravity", directory: DIRECTORY, adapter },
  {
    // `agy` fires none of UserPromptSubmit, SubagentStop and SessionEnd.
    events: {
      SessionStart: "SessionStart",
      PreToolUse: "PreToolUse",
      PostToolUse: "PostToolUse",
      Stop: "Stop",
    },
    // Tool event handlers stay grouped under the plugin's matcher, its tools renamed to the ones
    // `agy` calls. A PostToolUse answer injects nothing: only PostInvocation can, and it is not
    // relayed. A PreToolUse deny reaches the model, and a silent handler answers `allow`.
    toolNames: MATCHER_TOOLS,
    // `agy` reads a plugin's hooks from the `hooks.json` at its root.
    pluginFile: "hooks.json",
    // A flat build writes the project's `.agents/hooks.json`, keyed by hook name, which `agy`
    // runs each handler of from `<repo>/.agents`. An install writes each plugin's own `hooks.json`
    // instead (`PLUGIN_FILES`), and runs it from the plugin's directory.
    flat: {
      scriptsDir: `${DIRECTORY}hooks/`,
      sharedFile: `${DIRECTORY}hooks.json`,
    },
  }
);

/** Where `agy` loads a project's plugins from, each in a directory of its own. */
const PLUGINS_DIR = `${DIRECTORY}plugins/`;

/** What `agy` reads at a plugin's root besides its hooks: its manifest and its MCP servers. */
const PLUGIN_FILES = {
  manifest: "plugin.json",
  mcp: "mcp_config.json",
  pluginsDir: PLUGINS_DIR,
  // Split literal to avoid biome's noTemplateCurlyInString warning. Expanded in an MCP
  // server's definition to the plugin's directory, workspace plugins included.
  rootVariable: "$" + "{PLUGIN_ROOT}",
  marketplace: ".antigravity-plugin/marketplace.json",
};

const hooksSection = antigravityHooksSection(hooks, pluginFileHooksDelivery(hooks));

const PLUGIN_MCP = acceptedPluginMcp(PLUGIN_FILES.mcp);

export const antigravity = defineAiTool({
  toolId: "antigravity",
  // Where `aidd` finds its own distribution's files; `agy` reads the manifest, never the catalog.
  distributionProbes: {
    manifest: [PLUGIN_FILES.manifest],
    marketplace: [PLUGIN_FILES.marketplace],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Antigravity CLI",
  signalDir: null,
  hooks,
  buildContracts: {
    marketplace: contract(buildAntigravityPluginTreeContract, hooks, PLUGIN_FILES, AGENT_TOOLS),
    flat: contract(
      buildAntigravityFlatContract,
      hooks,
      { layout: ANTIGRAVITY_FLAT_LAYOUT, mcpPath: MCP_PATH },
      AGENT_TOOLS
    ),
  },

  capabilities: {
    agents: { format: "markdown", frontmatter: antigravityAgentFrontmatter(AGENT_TOOLS) },
    skills: {
      agentsSkillsDirectory: true,
    },
    rules: {
      buildInstallPath: installUnder(DIRECTORY, TOOL_SUFFIX, "rules/"),
      convertFrontmatter: activationTriggersRule,
    },
    mcp: {
      config: new McpConfigPart({
        outputPath: MCP_PATH,
        format: "json",
        consumes: [MCP_CONFIG_REF],
      }),
      plugin: PLUGIN_MCP,
    },
    hooks: hooksSection,
    layout: nativeLayout({ pluginsDir: PLUGINS_DIR, materializes: true }),
    manifest: manifestSection({
      manifestRelativePath: PLUGIN_FILES.manifest,
      pluginRootToken: PLUGIN_FILES.rootVariable,
    }),
  },

  linkSyntax: [],
});
