import { join } from "node:path";
import { CONFIG_MCP } from "../../capabilities/config-refs.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import { buildAiddCommandFilePath, convertCommandFrontmatter } from "../../formats/command.js";
import { nativeHooksSupport, projectHooksSupport } from "../../formats/hooks-descriptor.js";
import { pluginsCapability } from "../../plugins/plugins-capability.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { buildCursorContract, buildCursorFlatContract } from "./build.js";
import { cursorAgentFrontmatter } from "./cursor-agent.js";
import { CURSOR_DIRECTORY } from "./cursor-paths.js";
import { CURSOR_HOOKS } from "./hooks.js";

const DIRECTORY = CURSOR_DIRECTORY;
const TOOL_SUFFIX = ".cursor.md";
const MDC_EXT = ".mdc";

function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}${MDC_EXT}` : fileName;
}

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
    mcp: new McpCapability({
      outputPath: `${DIRECTORY}mcp.json`,
      format: "json",
      consumes: [CONFIG_MCP],
    }),
    plugins: pluginsCapability({
      mode: "native",
      // Empty so the translator computes pluginRoot as `<pluginName>/`, giving base-relative
      // keys such as "aidd-context/commands/foo.md".
      pluginsDir: "",
      pluginManifestRelativePath: null,
      ...nativeHooksSupport(CURSOR_HOOKS),
      ...projectHooksSupport(CURSOR_HOOKS),
      acceptsMcp: true,
      mcpRelativePath: "mcp.json",
      installScope: "user",
      userPluginsDir: (h) => join(h, ".cursor", "plugins", "local"),
    }),
  }),

  rewriteContent(content: string): string {
    return content
      .replace(/(@?)\.cursor\/commands\/(\d+)[_-][^/]+\/(?=\S)/g, "$1.cursor/commands/aidd/$2/")
      .replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc");
  },
});
