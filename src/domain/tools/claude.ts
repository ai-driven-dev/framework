import {
  AT_DOCS_PLACEHOLDER,
  AT_TOOLS_PLACEHOLDER,
  CONFIG_MCP,
  CONFIG_VSCODE_SETTINGS,
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

const DIRECTORY = ".claude/";
const TOOL_SUFFIX = ".claude.md";

function commandsDir(phase: string): string {
  return `${DIRECTORY}commands/aidd/${phase}/`;
}

export const claudeToolConfig: ToolConfig = {
  toolId: "claude",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  rewriteContent(content: string, docsDir: string): string {
    return content
      .replaceAll(AT_TOOLS_PLACEHOLDER, `@${DIRECTORY}`)
      .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`)
      .replace(/@\.claude\/commands\/(\d+)[_][^/]+\//g, (_, phase) => `@${commandsDir(phase)}`);
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
      buildFilePath(fileName: string): string | null {
        const slashIdx = fileName.indexOf("/");
        if (slashIdx !== -1) {
          const phaseDir = fileName.slice(0, slashIdx);
          const rest = fileName.slice(slashIdx + 1);
          const phase = phaseDir.match(/^(\d+)/)?.[1];
          if (phase) {
            return `${commandsDir(phase)}${rest}`;
          }
        }
        return `${DIRECTORY}commands/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(
        fm: Record<string, unknown>,
        relativeFileName: string
      ): Record<string, unknown> {
        const phase = relativeFileName.split("/")[0]?.match(/^(\d+)/)?.[1];
        const baseName = String(fm.name ?? "");
        const name = phase ? `aidd:${phase}:${baseName}` : baseName;
        const result: Record<string, unknown> = { name, description: fm.description };
        if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
        return result;
      },
    };
  },

  rules(): RulesHandler {
    return {
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}rules/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        if ("paths" in fm) {
          const paths = fm.paths;
          if (Array.isArray(paths) && paths.length === 0) return {};
          return { paths };
        }
        if ("globs" in fm) return { paths: fm.globs };
        if ("alwaysApply" in fm) return {};
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
    };
  },

  config(): ConfigHandler {
    return {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_MCP) return ".mcp.json";
        if (configName === CONFIG_VSCODE_SETTINGS) return ".vscode/settings.json";
        return null;
      },
      shouldMerge(configName: string): boolean {
        return configName === CONFIG_VSCODE_SETTINGS;
      },
    };
  },

  memoryBank(): MemoryBankHandler {
    return {
      outputPath(templateName: string): string | null {
        if (templateName === TEMPLATE_AGENTS_MD) return "CLAUDE.md";
        return null;
      },
      rewriteContent(content: string, docsDir: string): string {
        return claudeToolConfig.rewriteContent(content, docsDir);
      },
    };
  },
};

registerTool(claudeToolConfig);
