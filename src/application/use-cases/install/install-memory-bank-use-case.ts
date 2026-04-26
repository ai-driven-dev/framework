import { InstallationFile } from "../../../domain/models/file.js";
import type { TemplateRef } from "../../../domain/models/framework.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { AiTool, HasMemory } from "../../../domain/tools/contracts.js";

interface InstallMemoryBankOptions {
  toolConfig: AiTool<HasMemory>;
  templateRefs: readonly TemplateRef[];
  contentFiles: Map<string, string>;
  docsDir: string;
}

export class InstallMemoryBankUseCase {
  constructor(private readonly hasher: Hasher) {}

  execute(options: InstallMemoryBankOptions): InstallationFile[] {
    const { toolConfig, templateRefs, contentFiles, docsDir } = options;
    const cap = toolConfig.capabilities.memory;
    const results: InstallationFile[] = [];
    for (const ref of templateRefs) {
      const file = this.processTemplateRef(ref, cap, contentFiles, docsDir);
      if (file !== null) results.push(file);
    }
    return results;
  }

  private processTemplateRef(
    ref: TemplateRef,
    cap: AiTool<HasMemory>["capabilities"]["memory"],
    contentFiles: Map<string, string>,
    docsDir: string
  ): InstallationFile | null {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return null;
    const outputPath = cap.buildInstallPath(ref.name);
    if (outputPath === null) return null;
    const rewritten = cap.rewriteContent(rawContent, docsDir);
    return new InstallationFile({
      relativePath: outputPath,
      content: rewritten,
      hash: this.hasher.hash(rewritten),
      frameworkPath: ref.path,
    });
  }
}
