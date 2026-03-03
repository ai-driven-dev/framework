import type { ContentSection } from "../models/framework-descriptor.js";
import { ToolId } from "../models/tool-id.js";
import { ToolSpec } from "../models/tool-spec.js";

export class CopilotToolSpec extends ToolSpec {
  readonly toolId = ToolId.Copilot;
  readonly directory = ".github/";

  buildFilePath(section: ContentSection, fileName: string): string {
    switch (section.name) {
      case "agents": {
        const base = basename(fileName);
        const name = base.endsWith(".md") ? `${base.slice(0, -3)}.agent.md` : base;
        return `${this.directory}agents/${name}`;
      }
      case "commands": {
        const flat = flattenFileName(fileName, ".prompt.md");
        return `${this.directory}prompts/${flat}`;
      }
      case "rules": {
        const flat = flattenFileName(fileName, ".instructions.md");
        return `${this.directory}instructions/${flat}`;
      }
      case "skills":
        return `${this.directory}skills/${fileName}`;
      default:
        return `${this.directory}${fileName}`;
    }
  }

  override getMemoryBankOutputPath(templateName: string): string | null {
    if (templateName === "agentsMd") return `${this.directory}copilot-instructions.md`;
    return null;
  }

  override rewriteContent(content: string, docsDir: string): string {
    return content
      .replace(/@\{\{TOOLS\}\}\/(\S+)/g, (_match, path: string) => {
        return `[${basename(path)}](${this.directory}${path})`;
      })
      .replace(/@\{\{DOCS\}\}\/(\S+)/g, (_match, path: string) => {
        return `[${basename(path)}](${docsDir}/${path})`;
      })
      .replaceAll("{{TOOLS}}/", this.directory)
      .replaceAll("{{DOCS}}/", `${docsDir}/`);
  }

  convertFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown> {
    const { paths, ...rest } = frontmatter;
    if (!Array.isArray(paths) || paths.length === 0) {
      return { ...rest, applyTo: "**" };
    }
    return { ...rest, applyTo: paths[0] };
  }
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function flattenFileName(fileName: string, targetExt: string): string {
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
