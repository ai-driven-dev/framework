import type { ContentSection } from "../models/framework-descriptor.js";
import { ToolId, ToolSpec } from "../models/tool-spec.js";

export class CursorToolSpec extends ToolSpec {
  readonly toolId = ToolId.Cursor;
  readonly directory = ".cursor/";

  override buildFilePath(section: ContentSection, fileName: string): string {
    if (section.name === "rules") {
      const mdc = fileName.endsWith(".md") ? `${fileName.slice(0, -3)}.mdc` : fileName;
      return `${this.directory}${section.directory.replace(/^content\//, "")}/${mdc}`;
    }
    return super.buildFilePath(section, fileName);
  }

  override getConfigOutputPath(configName: string, _sourcePath: string): string | null {
    if (configName === "mcp") return ".cursor/mcp.json";
    return null;
  }

  protected convertPaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    const { paths, ...rest } = frontmatter;
    if (!Array.isArray(paths)) {
      return { ...frontmatter, alwaysApply: false };
    }
    return { ...rest, globs: paths, alwaysApply: false };
  }

  protected reversePaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    const { globs, alwaysApply: _alwaysApply, ...rest } = frontmatter;
    if (!Array.isArray(globs)) return frontmatter;
    return { ...rest, paths: globs };
  }
}

export const cursorToolSpec = new CursorToolSpec();
