import { GITKEEP_FILE, InstallationFile } from "../../../../../kernel/file.js";
import { parseFrontmatter } from "../../../../../kernel/markdown.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../../translate/domain/canon.js";

/**
 * The shape every content-section answer exposes with identical arity, so this engine calls
 * them without per-section branching. Where arity genuinely differs, a `ContentSectionDescriptor`
 * supplies the per-section adapter instead.
 */
export interface ContentSectionCapability {
  buildInstallPath(fileName: string): string | null;
  acceptsFileName(fileName: string): boolean;
  serialize(frontmatter: Record<string, unknown>, body: string): string;
}

/** Per-section behaviour no uniform signature can express: which answers the profile gives for
 * the section, and how its frontmatter is converted. */
export interface ContentSectionDescriptor<Cap extends ContentSectionCapability> {
  answersOf(tool: AiToolProfile): Cap | null;
  convertFrontmatter(
    cap: Cap,
    frontmatter: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown>;
}

export interface InstallContentSectionOptions {
  toolConfig: AiToolProfile;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallContentSectionUseCase<Cap extends ContentSectionCapability> {
  constructor(
    private readonly hasher: Hasher,
    private readonly descriptor: ContentSectionDescriptor<Cap>
  ) {}

  execute(options: InstallContentSectionOptions): InstallationFile[] {
    const { toolConfig, section, contentFiles } = options;
    const cap = this.descriptor.answersOf(toolConfig);
    if (cap === null) return [];
    const results: InstallationFile[] = [];
    for (const [filePath, rawContent] of contentFiles) {
      const file = this.processFile(filePath, rawContent, section, cap, toolConfig);
      if (file !== null) results.push(file);
    }
    return results;
  }

  private processFile(
    filePath: string,
    rawContent: string,
    section: ContentSection,
    cap: Cap,
    toolConfig: AiToolProfile
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
    return this.buildFile(filePath, outputPath, relativeFileName, rawContent, cap, toolConfig);
  }

  private buildFile(
    filePath: string,
    outputPath: string,
    relativeFileName: string,
    rawContent: string,
    cap: Cap,
    toolConfig: AiToolProfile
  ): InstallationFile {
    const rewrittenRaw = toolConfig.rewriteContent(rawContent);
    const { frontmatter, body } = parseFrontmatter(rewrittenRaw);
    const convertedFrontmatter = this.descriptor.convertFrontmatter(
      cap,
      frontmatter,
      relativeFileName
    );
    const outputContent = cap.serialize(convertedFrontmatter, body);
    return new InstallationFile({
      relativePath: outputPath,
      content: outputContent,
      hash: this.hasher.hash(outputContent),
      frameworkPath: filePath,
    });
  }
}
