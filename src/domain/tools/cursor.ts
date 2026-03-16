import {
  AT_DOCS_PLACEHOLDER,
  AT_TOOLS_PLACEHOLDER,
  CONFIG_MCP,
  DOCS_PLACEHOLDER,
  TEMPLATE_AGENTS_MD,
  TOOLS_PLACEHOLDER,
} from "../models/framework-descriptor.js";
import {
  type CommandsHandler,
  type ConfigHandler,
  type MemoryBankHandler,
  type RulesHandler,
  type SectionHandler,
  type ToolConfig,
  type UserFileSectionKey,
  agentNameFromFrontmatter,
  registerTool,
  stripToolSuffix,
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
    return content
      .replaceAll(AT_TOOLS_PLACEHOLDER, `@${DIRECTORY}`)
      .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`)
      .replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc");
  },

  reverseRewriteContent(content: string, docsDir: string): string {
    return content
      .replace(/(@\.cursor\/rules\/[^\s]+)\.mdc\b/g, "$1.md")
      .replaceAll(`@${DIRECTORY}`, AT_TOOLS_PLACEHOLDER)
      .replaceAll(`@${docsDir}/`, AT_DOCS_PLACEHOLDER)
      .replaceAll(DIRECTORY, TOOLS_PLACEHOLDER)
      .replaceAll(`${docsDir}/`, DOCS_PLACEHOLDER);
  },

  agents(): SectionHandler {
    return {
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}agents/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>, fileName?: string): Record<string, unknown> {
        return { name: agentNameFromFrontmatter(fm, fileName), description: fm.description };
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return { name: fm.name, description: fm.description };
      },
    };
  },

  commands(): CommandsHandler {
    return {
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}commands/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = { name: fm.name, description: fm.description };
        if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
        return result;
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = { name: fm.name, description: fm.description };
        if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
        return result;
      },
    };
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
    return {
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return fm;
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return fm;
      },
    };
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
    if (relativePath.startsWith(`${DIRECTORY}agents/`)) {
      return { section: "agents", key: relativePath.slice(`${DIRECTORY}agents/`.length) };
    }
    if (relativePath.startsWith(`${DIRECTORY}commands/`)) {
      return { section: "commands", key: relativePath.slice(`${DIRECTORY}commands/`.length) };
    }
    if (relativePath.startsWith(`${DIRECTORY}rules/`)) {
      const key = relativePath.slice(`${DIRECTORY}rules/`.length);
      return { section: "rules", key: key.endsWith(".mdc") ? `${key.slice(0, -4)}.md` : key };
    }
    if (relativePath.startsWith(`${DIRECTORY}skills/`)) {
      return { section: "skills", key: relativePath.slice(`${DIRECTORY}skills/`.length) };
    }
    return null;
  },
};

registerTool(cursorToolConfig);
