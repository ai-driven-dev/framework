import { ToolId, ToolSpec } from "../models/tool-spec.js";

export class ClaudeToolSpec extends ToolSpec {
  readonly toolId = ToolId.Claude;
  readonly directory = ".claude/";

  override getConfigOutputPath(configName: string, sourcePath: string): string | null {
    if (configName === "mcp") return sourcePath;
    return null;
  }

  protected convertPaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    return frontmatter;
  }

  protected reversePaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    return frontmatter;
  }
}

export const claudeToolSpec = new ClaudeToolSpec();
