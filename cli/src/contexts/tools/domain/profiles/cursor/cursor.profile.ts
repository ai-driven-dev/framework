import { join } from "node:path";
import cursorSettings from "../../../../../../assets/configs/cursor/settings.json" with {
  type: "json",
};
// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-cursor.cjs";
import { MCP_CONFIG_REF } from "../../../contract/config-refs.js";
import { buildAiddCommandFilePath, convertCommandFrontmatter } from "../../formats/command.js";
import { declareHooks } from "../../formats/hooks/declaration.js";
import { nativeHooksSupport, projectHooksSupport } from "../../formats/hooks/routes.js";
import { rulePatterns } from "../../formats/rule-frontmatter.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { nativeLayout } from "../../sections/layout-section.js";
import { manifestSection } from "../../sections/manifest-section.js";
import { acceptedPluginMcp, McpConfigPart } from "../../sections/mcp-section.js";
import { ModelsSection } from "../../sections/models-section.js";
import { cursorAgentFrontmatter } from "./cursor-agent.model.js";
import { buildCursorContract, buildCursorFlatContract } from "./cursor-build.model.js";

const PLUGIN_MCP = acceptedPluginMcp("mcp.json");

const DIRECTORY = ".cursor/";
const TOOL_SUFFIX = ".cursor.md";
const MDC_EXT = ".mdc";

function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}${MDC_EXT}` : fileName;
}

/** A scoped rule keeps its globs and never applies on its own; an unscoped one survives only as
 * an on-request rule that has a description. */
function cursorRuleFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  const patterns = rulePatterns(fm);
  const described = fm.description === undefined ? {} : { description: fm.description };
  if (patterns.length > 0) {
    return {
      ...described,
      globs: JSON.stringify(patterns).replace(/,/g, ", "),
      alwaysApply: false,
    };
  }
  return fm.alwaysApply === false && fm.description !== undefined
    ? { ...described, alwaysApply: false }
    : {};
}

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
      Stop: ["stop", "sessionEnd"],
      SubagentStop: "subagentStop",
    },
    rootToken: CURSOR_PLUGIN_ROOT_TOKEN,
    manifestNamesHooks: true,
    // `Stop` fans out to two Cursor events, not one: interactive sessions fire `stop` and headless
    // ones `sessionEnd` instead: never both from the same run, but which one depends on how the
    // session ends, so both are subscribed. A run file already tolerates more than one `turn_end`
    // line, so a session firing both is not a problem.
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
    marketplace: () => buildCursorContract(hooks),
    flat: () => buildCursorFlatContract(hooks),
  },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "markdown",
      frontmatter: cursorAgentFrontmatter,
      // Cursor keeps single quotes as part of the value, so `'name'` would be the agent's name.
      quote: "double",
    }),
    skills: bound.skills({}),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) => convertCommandFrontmatter(fm, relativeFileName),
    }),
    rules: bound.rules({
      buildInstallPath: (fileName) => toMdc(bound.installUnder("rules/")(fileName)),
      convertFrontmatter: cursorRuleFrontmatter,
    }),
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
      userPluginsDir: (h) => join(h, ".cursor", "plugins", "local"),
    }),
    manifest: manifestSection({
      manifestRelativePath: null,
      pluginRootToken: CURSOR_ROOT_TOKEN,
    }),
    models: new ModelsSection({ providers: ["anthropic"] }),
  }),

  linkSyntax: [
    { from: /(@?)\.cursor\/commands\/(\d+)[_-][^/]+\/(?=\S)/g, to: "$1.cursor/commands/aidd/$2/" },
    { from: /(@\.cursor\/rules\/[^\s]+)\.md\b/g, to: "$1.mdc" },
  ],
});
