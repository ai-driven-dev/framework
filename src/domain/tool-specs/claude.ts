import type { ContentSection } from "../models/framework-descriptor.js";
import { ToolId, ToolSpec } from "../models/tool-spec.js";

export class ClaudeToolSpec extends ToolSpec {
  readonly toolId = ToolId.Claude;
  readonly directory = ".claude/";

  override getConfigOutputPath(configName: string, _sourcePath: string): string | null {
    if (configName === "mcp") return ".mcp.json";
    return null;
  }

  override getMemoryBankOutputPath(templateName: string): string | null {
    if (templateName === "agentsMd") return "CLAUDE.md";
    return null;
  }

  override buildFilePath(section: ContentSection, fileName: string): string {
    if (section.name === "commands") {
      const slashIdx = fileName.indexOf("/");
      if (slashIdx !== -1) {
        const phaseDir = fileName.slice(0, slashIdx);
        const rest = fileName.slice(slashIdx + 1);
        const phase = phaseDir.match(/^(\d+)/)?.[1];
        if (phase) {
          return `.claude/commands/aidd/${phase}/${rest}`;
        }
      }
    }
    return super.buildFilePath(section, fileName);
  }

  override rewriteContent(content: string, docsDir: string): string {
    return super
      .rewriteContent(content, docsDir)
      .replace(
        /@\.claude\/commands\/(\d+)[_][^/]+\//g,
        (_, phase) => `@.claude/commands/aidd/${phase}/`
      );
  }

  protected convertPaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    return frontmatter;
  }
}

export const claudeToolSpec = new ClaudeToolSpec();
