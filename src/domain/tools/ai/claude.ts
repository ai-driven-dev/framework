import { CONFIG_MCP, TEMPLATE_AGENTS_MD } from "../../models/framework-descriptor.js";
import type { MergeStrategy } from "../../models/merge-strategy.js";
import {
  type AiToolConfig,
  baseReverseRewriteContent,
  baseRewriteContent,
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
  type UserFileSectionKey,
} from "../../models/tool-config.js";

const DIRECTORY = ".claude/";
const TOOL_SUFFIX = ".claude.md";

function commandsDir(phase: string): string {
  return `${DIRECTORY}commands/aidd/${phase}/`;
}

export const claudeToolConfig: AiToolConfig = {
  kind: "ai",
  toolId: "claude",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  signalDir: ".claude/commands",

  rewriteContent(content: string, docsDir: string): string {
    return baseRewriteContent(content, DIRECTORY, docsDir).replace(
      /(@?)\.claude\/commands\/(\d+)[_][^/]+\//g,
      (_, at, phase) => `${at}${commandsDir(phase)}`
    );
  },

  reverseRewriteContent(content: string, docsDir: string): string {
    return baseReverseRewriteContent(content, DIRECTORY, docsDir);
  },

  agents(): SectionHandler {
    return namedAgentsSectionHandler(DIRECTORY, TOOL_SUFFIX);
  },

  commands(): CommandsHandler {
    return buildStandardCommandsHandler((fileName: string): string | null => {
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
    });
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
        if ("alwaysApply" in fm) {
          if (fm.alwaysApply === false && fm.description !== undefined) {
            return { description: fm.description };
          }
          return {};
        }
        return {};
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return Array.isArray(fm.paths) && fm.paths.length > 0 ? { paths: fm.paths } : {};
      },
    };
  },

  skills(): SectionHandler {
    return passthroughSkillsHandler(DIRECTORY, TOOL_SUFFIX);
  },

  config(): ConfigHandler {
    return {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_MCP) return ".mcp.json";
        return null;
      },
      mergeStrategy(configName: string): MergeStrategy {
        if (configName === CONFIG_MCP) return "user-prime";
        return "none";
      },
      entrySection(configName: string): string | null {
        if (configName === CONFIG_MCP) return "mcpServers";
        return null;
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

  detectUserFileSectionKey(relativePath: string): UserFileSectionKey | null {
    return detectSectionKeyFromPrefixes(relativePath, [
      [`${DIRECTORY}agents/`, "agents"],
      [`${DIRECTORY}commands/aidd/`, "commands"],
      [`${DIRECTORY}rules/`, "rules"],
      [`${DIRECTORY}skills/`, "skills"],
    ]);
  },
};

registerTool(claudeToolConfig);
