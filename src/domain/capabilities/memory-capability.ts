import { TEMPLATE_AGENTS_MD } from "../models/framework.js";

export class MemoryCapability {
  constructor(
    readonly params: {
      outputFileName: string;
      rewriteContent: (content: string, docsDir: string) => string;
    }
  ) {}

  buildInstallPath(templateName: string): string | null {
    if (templateName !== TEMPLATE_AGENTS_MD) return null;
    return this.params.outputFileName;
  }

  buildOutputPath(): string {
    return this.params.outputFileName;
  }

  rewriteContent(content: string, docsDir: string): string {
    return this.params.rewriteContent(content, docsDir);
  }

  accepts(relativePath: string): boolean {
    return relativePath.endsWith(this.params.outputFileName);
  }

  equals(other: MemoryCapability): boolean {
    return this.params.outputFileName === other.params.outputFileName;
  }
}
