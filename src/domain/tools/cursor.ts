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

  agents(): SectionHandler {
    return {
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}agents/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
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
    };
  },

  rules(): RulesHandler {
    return {
      buildFilePath(fileName: string): string {
        const stripped = stripToolSuffix(TOOL_SUFFIX, fileName);
        return `${DIRECTORY}rules/${toMdc(stripped)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        const { paths, globs, alwaysApply, ...rest } = fm;
        const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
        if (patterns === null) return { ...rest, alwaysApply: alwaysApply ?? true };
        return { ...rest, globs: JSON.stringify(patterns).replace(/,/g, ", "), alwaysApply: false };
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
};

registerTool(cursorToolConfig);
