import type { ContentSection } from "../models/framework-descriptor.js";
import { parseFrontmatter } from "../models/frontmatter.js";
import { type ToolConfig, registerTool } from "../models/tool-config.js";

const DIRECTORY = ".github/";
const TOOL_SUFFIX = ".copilot.md";

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function flattenFileName(
  fileName: string,
  targetExt: string,
  options: { toolSuffix?: string; stripNumericPrefix?: boolean } = {}
): string {
  const parts = fileName.split("/");
  let baseName = parts[parts.length - 1];

  if (options.stripNumericPrefix) {
    baseName = baseName.replace(/^\d+[_-]/, "");
  }
  if (options.toolSuffix && baseName.endsWith(options.toolSuffix)) {
    baseName = `${baseName.slice(0, -options.toolSuffix.length)}.md`;
  }
  baseName = baseName.replaceAll("_", "-");

  const withExt = addTargetExtension(baseName, targetExt);

  if (parts.length === 1) {
    return withExt;
  }

  const prefix = buildPrefix(parts.slice(0, -1).join("/"));
  return `${prefix}-${withExt}`;
}

function buildPrefix(subPath: string): string {
  return subPath
    .split("/")
    .map((p) => p.replace(/^(\d+)[_-].*$/, "$1"))
    .join("-");
}

function addTargetExtension(baseName: string, targetExt: string): string {
  if (baseName.endsWith(targetExt)) return baseName;
  const withoutMd = baseName.endsWith(".md") ? baseName.slice(0, -3) : baseName;
  return `${withoutMd}${targetExt}`;
}

function rewriteCopilotContent(content: string, docsDir: string): string {
  return content
    .replace(/@\{\{TOOLS\}\}\/(\S+)/g, (_match, path: string) => {
      return `[${basename(path)}](${DIRECTORY}${path})`;
    })
    .replace(/@\{\{DOCS\}\}\/(\S+)/g, (_match, path: string) => {
      return `[${basename(path)}](${docsDir}/${path})`;
    })
    .replaceAll("{{TOOLS}}/", DIRECTORY)
    .replaceAll("{{DOCS}}/", `${docsDir}/`);
}

export const copilotToolConfig: ToolConfig = {
  toolId: "copilot",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  buildFilePath(section: ContentSection, fileName: string): string | null {
    const base = basename(fileName);
    if (base === ".gitkeep") return null;

    switch (section.name) {
      case "agents": {
        const name = base.endsWith(".md") ? `${base.slice(0, -3)}.agent.md` : base;
        return `${DIRECTORY}agents/${name}`;
      }
      case "commands": {
        const flat = flattenFileName(fileName, ".prompt.md");
        return `${DIRECTORY}prompts/${flat}`;
      }
      case "rules": {
        const flat = flattenFileName(fileName, ".instructions.md", {
          toolSuffix: TOOL_SUFFIX,
          stripNumericPrefix: true,
        });
        return `${DIRECTORY}instructions/${flat}`;
      }
      case "skills":
        return `${DIRECTORY}skills/${fileName}`;
      default:
        return `${DIRECTORY}${fileName}`;
    }
  },

  rewriteContent: rewriteCopilotContent,

  convertFrontmatter(
    frontmatter: Record<string, unknown>,
    section: ContentSection
  ): Record<string, unknown> {
    if (section.name !== "rules") return frontmatter;
    const { paths, globs } = frontmatter;
    const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
    if (patterns === null || patterns.length === 0) return { applyTo: "**" };
    return { applyTo: `"${patterns.join(",")}"` };
  },

  getConfigOutputPath(configName: string): string | null {
    if (configName === "mcp") return ".vscode/mcp.json";
    if (configName === "vscodeExtensions") return ".vscode/extensions.json";
    if (configName === "vscodeKeybindings") return ".vscode/keybindings.json";
    if (configName === "vscodeSettings") return ".vscode/settings.json";
    return null;
  },

  getMemoryBankOutputPath(templateName: string): string | null {
    if (templateName === "agentsMd") return `${DIRECTORY}copilot-instructions.md`;
    return null;
  },

  rewriteMemoryBankContent(content: string, docsDir: string): string {
    const rewritten = rewriteCopilotContent(content, docsDir);
    const { body } = parseFrontmatter(rewritten);
    return body.replace(new RegExp(`\\]\\(${docsDir}/`, "g"), `](../${docsDir}/`);
  },

  shouldProcess(section: ContentSection, frontmatter: Record<string, unknown>): boolean {
    if (section.name !== "rules") return true;
    const hasGlobs =
      (Array.isArray(frontmatter.globs) && frontmatter.globs.length > 0) ||
      (Array.isArray(frontmatter.paths) && frontmatter.paths.length > 0);
    const alwaysApply = frontmatter.alwaysApply === true || frontmatter.applyTo !== undefined;
    return hasGlobs || alwaysApply;
  },
};

registerTool(copilotToolConfig);
