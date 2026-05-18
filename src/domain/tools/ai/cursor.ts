import { AgentsCapability } from "../../capabilities/agents-capability.js";
import { CommandsCapability } from "../../capabilities/commands-capability.js";
import { buildClaudeStyleMarketplaceEntry } from "../../capabilities/marketplace-entry.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import { PluginsCapability } from "../../capabilities/plugins-capability.js";
import { RulesCapability } from "../../capabilities/rules-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatter,
  detectSectionKeyFromPrefixes,
  reverseConvertCommandFrontmatter,
  stripToolSuffix,
} from "../../formats/command.js";
import { baseReverseRewriteContent, baseRewriteContent } from "../../formats/placeholders.js";
import { CONFIG_MCP } from "../../models/framework.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasMcp,
  HasPlugins,
  HasRules,
  HasSkills,
  UserFileSectionKey,
} from "../contracts.js";
import { registerTool } from "../registry.js";

const DIRECTORY = ".cursor/";
const TOOL_SUFFIX = ".cursor.md";
const MDC_EXT = ".mdc";

function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}${MDC_EXT}` : fileName;
}

export const cursor: AiTool<HasAgents & HasSkills & HasCommands & HasRules & HasMcp & HasPlugins> =
  {
    kind: "ai",
    toolId: "cursor",
    directory: DIRECTORY,
    toolSuffix: TOOL_SUFFIX,
    signalDir: ".cursor/commands",
    configOutputPaths: { "settings.json": ".cursor/settings.json" },

    capabilities: {
      agents: new AgentsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        format: "markdown",
      }),
      skills: new SkillsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) =>
          `${DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
        convertFrontmatter: (fm) => fm,
        reverseConvertFrontmatter: (fm) => fm,
      }),
      commands: new CommandsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
        convertFrontmatter: (fm, relativeFileName) =>
          convertCommandFrontmatter(fm, relativeFileName),
        reverseConvertFrontmatter: (fm) => reverseConvertCommandFrontmatter(fm),
      }),
      rules: new RulesCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) =>
          `${DIRECTORY}rules/${toMdc(stripToolSuffix(TOOL_SUFFIX, fileName))}`,
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
        reverseConvertFrontmatter: (fm) => {
          const { globs } = fm;
          if (Array.isArray(globs) && globs.length > 0) return { paths: globs };
          if (typeof globs === "string") {
            try {
              const parsed = JSON.parse(globs);
              if (Array.isArray(parsed) && parsed.length > 0) return { paths: parsed };
            } catch {
              /* globs is not valid JSON */
            }
          }
          return {};
        },
      }),
      mcp: new McpCapability({
        outputPath: `${DIRECTORY}mcp.json`,
        format: "json",
        entrySection: "mcpServers",
        consumes: [CONFIG_MCP],
      }),
      plugins: new PluginsCapability({
        mode: "native",
        pluginsDir: ".cursor/plugins/",
        pluginManifestRelativePath: "plugin.json",
        mcpRelativePath: "mcp.json",
        acceptsHooks: true,
        acceptsMcp: true,
        hooksContentFormat: "cursor",
        translationMode: "marketplace",
        // Project-local mirror using the same schema as Claude Code / Copilot.
        // Cursor's native marketplace install path is UI-dashboard-driven (no
        // project-scoped JSON spec today). This file provides forward-compat
        // when Cursor ships a project-local spec, and an audit trail for users
        // inspecting setup output.
        marketplaceSettings: {
          settingsPath: ".cursor/settings.json",
          settingsKey: "extraKnownMarketplaces",
          enabledPluginsKey: "enabledPlugins",
          toEntry: buildClaudeStyleMarketplaceEntry,
        },
      }),
    },

    rewriteContent(content: string, docsDir: string): string {
      return baseRewriteContent(content, DIRECTORY, docsDir)
        .replace(
          /(@?)\.cursor\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
          "$1.cursor/commands/aidd/$2/$3"
        )
        .replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc");
    },

    reverseRewriteContent(content: string, docsDir: string): string {
      return baseReverseRewriteContent(
        content.replace(/(@\.cursor\/rules\/[^\s]+)\.mdc\b/g, "$1.md"),
        DIRECTORY,
        docsDir
      );
    },

    detectUserFileSectionKey(relativePath: string): UserFileSectionKey | null {
      if (relativePath.startsWith(`${DIRECTORY}rules/`)) {
        const key = relativePath.slice(`${DIRECTORY}rules/`.length);
        return { section: "rules", key: key.endsWith(".mdc") ? `${key.slice(0, -4)}.md` : key };
      }
      return detectSectionKeyFromPrefixes(relativePath, [
        [`${DIRECTORY}agents/`, "agents"],
        [`${DIRECTORY}commands/aidd/`, "commands"],
        [`${DIRECTORY}skills/`, "skills"],
      ]);
    },
  };

registerTool(cursor);
