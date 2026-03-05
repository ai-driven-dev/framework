import type { ContentSection } from "../models/framework-descriptor.js";
import { type ToolConfig, registerTool, stripToolSuffix } from "../models/tool-config.js";

const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
const DOCS_PLACEHOLDER = "{{DOCS}}/";
const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

const DIRECTORY = ".claude/";
const TOOL_SUFFIX = ".claude.md";

function commandsDir(phase: string): string {
  return `${DIRECTORY}commands/aidd/${phase}/`;
}

export const claudeToolConfig: ToolConfig = {
  toolId: "claude",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  buildFilePath(section: ContentSection, fileName: string): string {
    if (section.name === "commands") {
      const slashIdx = fileName.indexOf("/");
      if (slashIdx !== -1) {
        const phaseDir = fileName.slice(0, slashIdx);
        const rest = fileName.slice(slashIdx + 1);
        const phase = phaseDir.match(/^(\d+)/)?.[1];
        if (phase) {
          return `${commandsDir(phase)}${rest}`;
        }
      }
    }
    return `${DIRECTORY}${section.directory}/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
  },

  rewriteContent(content: string, docsDir: string): string {
    return content
      .replaceAll(AT_TOOLS_PLACEHOLDER, `@${DIRECTORY}`)
      .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`)
      .replace(/@\.claude\/commands\/(\d+)[_][^/]+\//g, (_, phase) => `@${commandsDir(phase)}`);
  },

  convertFrontmatter(
    frontmatter: Record<string, unknown>,
    section: ContentSection
  ): Record<string, unknown> {
    if (section.name !== "rules") return frontmatter;
    if ("paths" in frontmatter) return { paths: frontmatter.paths };
    if ("globs" in frontmatter) return { paths: frontmatter.globs };
    if (frontmatter.alwaysApply === true) return {};
    if ("alwaysApply" in frontmatter) return { paths: [] };
    return {};
  },

  getConfigOutputPath(configName: string): string | null {
    if (configName === "mcp") return ".mcp.json";
    if (configName === "vscodeSettings") return ".vscode/settings.json";
    return null;
  },

  getMemoryBankOutputPath(templateName: string): string | null {
    if (templateName === "agentsMd") return "CLAUDE.md";
    return null;
  },
};

registerTool(claudeToolConfig);
