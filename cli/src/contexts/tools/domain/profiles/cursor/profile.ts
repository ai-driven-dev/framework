import { join } from "node:path";
import cursorSettings from "../../../../../../assets/configs/cursor/settings.json" with {
  type: "json",
};
import { CONFIG_MCP } from "../../../contract/config-refs.js";
import { buildAiddCommandFilePath, convertCommandFrontmatter } from "../../formats/command.js";
import { nativeHooksSupport, projectHooksSupport } from "../../formats/hooks-descriptor.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { nativeLayout } from "../../sections/layout-section.js";
import { manifestSection } from "../../sections/manifest-section.js";
import { acceptedPluginMcp, McpConfigPart } from "../../sections/mcp-section.js";
import { buildCursorContract, buildCursorFlatContract } from "./build.js";
import { cursorAgentFrontmatter } from "./cursor-agent.js";
import { CURSOR_DIRECTORY } from "./cursor-paths.js";
import { CURSOR_HOOKS } from "./hooks.js";

const PLUGIN_MCP = acceptedPluginMcp("mcp.json");

const DIRECTORY = CURSOR_DIRECTORY;
const TOOL_SUFFIX = ".cursor.md";
const MDC_EXT = ".mdc";

function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}${MDC_EXT}` : fileName;
}

const hooksDelivery = projectHooksSupport(CURSOR_HOOKS);
const CURSOR_ROOT_TOKEN = nativeHooksSupport(CURSOR_HOOKS).rootToken;

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
  configOutputPaths: { "settings.json": ".cursor/settings.json" },
  configAssets: { "settings.json": cursorSettings },
  buildContracts: { marketplace: buildCursorContract, flat: buildCursorFlatContract },

  capabilities: (bound) => ({
    agents: bound.agents({
      format: "markdown",
      frontmatter: cursorAgentFrontmatter,
      // Cursor keeps single quotes as part of the value, so `'name'` would be the agent's name.
      quote: "double",
    }),
    skills: bound.skills({
      buildInstallPath: bound.installUnder("skills/"),
      convertFrontmatter: (fm) => fm,
    }),
    commands: bound.commands({
      buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) => convertCommandFrontmatter(fm, relativeFileName),
    }),
    rules: bound.rules({
      buildInstallPath: (fileName) => {
        const stripped = bound.installUnder("rules/")(fileName);
        return toMdc(stripped);
      },
      convertFrontmatter: (fm) => {
        const { paths, globs, description } = fm;
        const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
        if (patterns === null || patterns.length === 0) {
          if (fm.alwaysApply === false && description !== undefined) {
            return { description, alwaysApply: false };
          }
          return {};
        }
        const result: Record<string, unknown> = {};
        if (description !== undefined) result.description = description;
        return {
          ...result,
          globs: JSON.stringify(patterns).replace(/,/g, ", "),
          alwaysApply: false,
        };
      },
    }),
    mcp: {
      config: new McpConfigPart({
        outputPath: `${DIRECTORY}mcp.json`,
        format: "json",
        consumes: [CONFIG_MCP],
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
  }),

  rewriteContent(content: string): string {
    return content
      .replace(/(@?)\.cursor\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g, "$1.cursor/commands/aidd/$2/$3")
      .replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc");
  },
});
