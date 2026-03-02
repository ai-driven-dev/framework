import type { ContentSection } from "../models/framework-descriptor.js";
import { ToolId, ToolSpec } from "../models/tool-spec.js";

export class CopilotToolSpec extends ToolSpec {
  readonly toolId = ToolId.Copilot;
  readonly directory = ".github/";

  buildFilePath(section: ContentSection, fileName: string): string {
    switch (section.name) {
      case "agents": {
        const base = fileName.split("/").at(-1) ?? fileName;
        const name = base.endsWith(".md") ? `${base.slice(0, -3)}.agent.md` : base;
        return `.github/agents/${name}`;
      }
      case "commands": {
        const flat = flattenFileName(section, fileName, ".prompt.md");
        return `.github/prompts/${flat}`;
      }
      case "rules": {
        const flat = flattenFileName(section, fileName, ".instructions.md");
        return `.github/instructions/${flat}`;
      }
      case "skills":
        return `.github/skills/${fileName}`;
      default:
        return `.github/${fileName}`;
    }
  }

  override getMemoryBankOutputPath(templateName: string): string | null {
    if (templateName === "agentsMd") return ".github/copilot-instructions.md";
    return null;
  }

  override rewriteContent(content: string, docsDir: string): string {
    return content
      .replace(/@\{\{TOOLS\}\}\/(\S+)/g, (_match, path: string) => {
        const filename = path.split("/").at(-1) ?? path;
        return `[${filename}](${this.directory}${path})`;
      })
      .replace(/@\{\{DOCS\}\}\/(\S+)/g, (_match, path: string) => {
        const filename = path.split("/").at(-1) ?? path;
        return `[${filename}](${docsDir}/${path})`;
      })
      .replaceAll("{{TOOLS}}/", this.directory)
      .replaceAll("{{DOCS}}/", `${docsDir}/`);
  }

  protected convertPaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    const { paths, ...rest } = frontmatter;
    if (!Array.isArray(paths) || paths.length === 0) {
      return { ...rest, applyTo: "**" };
    }
    return { ...rest, applyTo: paths[0] };
  }

}

function flattenFileName(_section: ContentSection, fileName: string, targetExt: string): string {
  const parts = fileName.split("/");
  const baseName = parts[parts.length - 1];
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

export const copilotToolSpec = new CopilotToolSpec();
