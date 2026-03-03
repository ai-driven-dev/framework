import type { ContentSection } from "./framework-descriptor.js";
import type { ToolId } from "./tool-id.js";

const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
const DOCS_PLACEHOLDER = "{{DOCS}}/";
const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

export abstract class ToolSpec {
  abstract readonly toolId: ToolId;
  abstract readonly directory: string;

  rewriteContent(content: string, docsDir: string): string {
    return content
      .replaceAll(AT_TOOLS_PLACEHOLDER, `@${this.directory}`)
      .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
      .replaceAll(TOOLS_PLACEHOLDER, this.directory)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`);
  }

  buildFilePath(section: ContentSection, fileName: string): string {
    return `${this.directory}${section.directory}/${fileName}`;
  }

  getConfigOutputPath(_configName: string): string | null {
    return null;
  }

  getMemoryBankOutputPath(_templateName: string): string | null {
    return null;
  }

  abstract convertFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown>;
}
