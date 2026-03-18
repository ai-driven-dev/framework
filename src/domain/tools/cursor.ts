import { CONFIG_MCP, TEMPLATE_AGENTS_MD } from "../models/framework-descriptor.js";
import {
  baseReverseRewriteContent,
  baseRewriteContent,
  buildAiddCommandFilePath,
  buildStandardCommandsHandler,
  type CommandsHandler,
  type ConfigHandler,
  detectSectionKeyFromPrefixes,
  type MemoryBankHandler,
  namedAgentsSectionHandler,
  passthroughSkillsHandler,
  type RulesHandler,
  registerTool,
  type SectionHandler,
  stripToolSuffix,
  type ToolConfig,
  type UserFileSectionKey,
} from "../models/tool-config.js";

const DIRECTORY = ".cursor/";
const TOOL_SUFFIX = ".cursor.md";
const MDC_EXT = ".mdc";

function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}${MDC_EXT}` : fileName;
}

export const cursorToolConfig: ToolConfig = {
  toolId: "cursor",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  rewriteContent(content: string, docsDir: string): string {
    return baseRewriteContent(content, DIRECTORY, docsDir)
      .replace(/(@\.cursor\/commands\/)(\d+)[_-][^/]+\/([^\s]+)/g, "$1aidd/$2/$3")
      .replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc");
  },

  reverseRewriteContent(content: string, docsDir: string): string {
    return baseReverseRewriteContent(
      content.replace(/(@\.cursor\/rules\/[^\s]+)\.mdc\b/g, "$1.md"),
      DIRECTORY,
      docsDir
    );
  },

  agents(): SectionHandler {
    return namedAgentsSectionHandler(DIRECTORY, TOOL_SUFFIX);
  },

  commands(): CommandsHandler {
    return buildStandardCommandsHandler((fileName) =>
      buildAiddCommandFilePath(DIRECTORY, fileName)
    );
  },

  rules(): RulesHandler {
    return {
      buildFilePath(fileName: string): string {
        const stripped = stripToolSuffix(TOOL_SUFFIX, fileName);
        return `${DIRECTORY}rules/${toMdc(stripped)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        const { paths, globs, description } = fm;
        const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
        if (patterns === null || patterns.length === 0) return {};
        const result: Record<string, unknown> = {};
        if (description !== undefined) result.description = description;
        return {
          ...result,
          globs: JSON.stringify(patterns).replace(/,/g, ", "),
          alwaysApply: false,
        };
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        const { globs } = fm;
        if (Array.isArray(globs) && globs.length > 0) return { paths: globs };
        if (typeof globs === "string") {
          try {
            const parsed = JSON.parse(globs);
            if (Array.isArray(parsed) && parsed.length > 0) return { paths: parsed };
          } catch {
            // globs is not valid JSON — no paths
          }
        }
        return {};
      },
    };
  },

  skills(): SectionHandler {
    return passthroughSkillsHandler(DIRECTORY, TOOL_SUFFIX);
  },

  config(): ConfigHandler {
    return {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_MCP) return `${DIRECTORY}mcp.json`;
        return null;
      },
      shouldMerge(_configName: string): boolean {
        return false;
      },
    };
  },

  memoryBank(): MemoryBankHandler {
    return {
      outputPath(templateName: string): string | null {
        if (templateName === TEMPLATE_AGENTS_MD) return "AGENTS.md";
        return null;
      },
      rewriteContent(content: string, docsDir: string): string {
        return cursorToolConfig.rewriteContent(content, docsDir);
      },
    };
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

registerTool(cursorToolConfig);
