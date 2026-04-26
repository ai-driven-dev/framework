import { parseFrontmatter, serializeFrontmatter } from "../../../domain/formats/markdown.js";
import { InstallationFile } from "../../../domain/models/file.js";
import type { ContentSection } from "../../../domain/models/framework.js";
import { GITKEEP_FILE } from "../../../domain/models/framework.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { AiTool, HasCommands } from "../../../domain/tools/contracts.js";

interface UpdateCommandsOptions {
  toolConfig: AiTool<HasCommands>;
  section: ContentSection;
  contentFiles: Map<string, string>;
  docsDir: string;
}

export class UpdateCommandsUseCase {
  constructor(private readonly hasher: Hasher) {}

  execute(options: UpdateCommandsOptions): InstallationFile[] {
    const { toolConfig, section, contentFiles, docsDir } = options;
    const cap = toolConfig.capabilities.commands;
    const results: InstallationFile[] = [];
    for (const [filePath, rawContent] of contentFiles) {
      const file = this.processFile(filePath, rawContent, section, cap, toolConfig, docsDir);
      if (file !== null) results.push(file);
    }
    return results;
  }

  private processFile(
    filePath: string,
    rawContent: string,
    section: ContentSection,
    cap: AiTool<HasCommands>["capabilities"]["commands"],
    toolConfig: AiTool<HasCommands>,
    docsDir: string
  ): InstallationFile | null {
    if (!filePath.startsWith(`${section.directory}/`)) return null;
    const relativeFileName = filePath.slice(`${section.directory}/`.length);
    if (!cap.acceptsFileName(relativeFileName)) return null;
    if (section.entryFile !== null) {
      const basename = relativeFileName.split("/").at(-1) ?? relativeFileName;
      if (basename !== section.entryFile) return null;
    }
    const outputPath = cap.buildInstallPath(relativeFileName);
    if (outputPath === null) return null;
    if (relativeFileName.endsWith(GITKEEP_FILE)) {
      return new InstallationFile({
        relativePath: outputPath,
        content: "",
        hash: this.hasher.hash(""),
        frameworkPath: filePath,
      });
    }
    return this.buildFile(
      filePath,
      outputPath,
      relativeFileName,
      rawContent,
      cap,
      toolConfig,
      docsDir
    );
  }

  private buildFile(
    filePath: string,
    outputPath: string,
    relativeFileName: string,
    rawContent: string,
    cap: AiTool<HasCommands>["capabilities"]["commands"],
    toolConfig: AiTool<HasCommands>,
    docsDir: string
  ): InstallationFile {
    const rewrittenRaw = toolConfig.rewriteContent(rawContent, docsDir);
    const { frontmatter, body } = parseFrontmatter(rewrittenRaw);
    const convertedFrontmatter = cap.convertFrontmatter(frontmatter, relativeFileName);
    const outputContent = serializeFrontmatter(convertedFrontmatter, body);
    return new InstallationFile({
      relativePath: outputPath,
      content: outputContent,
      hash: this.hasher.hash(outputContent),
      frameworkPath: filePath,
    });
  }
}
