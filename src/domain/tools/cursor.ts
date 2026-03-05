import type { ContentSection } from "../models/framework-descriptor.js";
import { type ToolConfig, registerTool, stripToolSuffix } from "../models/tool-config.js";

const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
const DOCS_PLACEHOLDER = "{{DOCS}}/";
const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

const DIRECTORY = ".cursor/";
const TOOL_SUFFIX = ".cursor.md";

export const cursorToolConfig: ToolConfig = {
  toolId: "cursor",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  buildFilePath(section: ContentSection, fileName: string): string {
    if (section.name === "rules") {
      const stripped = stripToolSuffix(TOOL_SUFFIX, fileName);
      const mdc = stripped.endsWith(".md") ? `${stripped.slice(0, -3)}.mdc` : stripped;
      return `${DIRECTORY}${section.directory}/${mdc}`;
    }
    return `${DIRECTORY}${section.directory}/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
  },

  rewriteContent(content: string, docsDir: string): string {
    return content
      .replaceAll(AT_TOOLS_PLACEHOLDER, `@${DIRECTORY}`)
      .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`);
  },

  convertFrontmatter(
    frontmatter: Record<string, unknown>,
    section: ContentSection
  ): Record<string, unknown> {
    if (section.name !== "rules") return frontmatter;
    const { paths, globs, alwaysApply, ...rest } = frontmatter;
    const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
    if (patterns === null) return { ...rest, alwaysApply: alwaysApply ?? true };
    return { ...rest, globs: JSON.stringify(patterns), alwaysApply: false };
  },

  getConfigOutputPath(configName: string): string | null {
    if (configName === "mcp") return `${DIRECTORY}mcp.json`;
    return null;
  },

  getMemoryBankOutputPath(templateName: string): string | null {
    if (templateName === "agentsMd") return "AGENTS.md";
    return null;
  },
};

registerTool(cursorToolConfig);
