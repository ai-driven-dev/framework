import { FileHash } from "../../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import { parseFrontmatter } from "../../../../../shared/domain/markdown.js";
import { GITKEEP_FILE } from "../../../../../shared/domain/redundant-gitkeeps.js";
import type { ContentSection } from "../../../domain/canon.js";
import type { ContentSections } from "../../../ports/tool-sections.js";

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
  answersOf(tool: ContentSections): Cap | null;
  convertFrontmatter(
    cap: Cap,
    frontmatter: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown>;
}

export interface InstallContentSectionCommand {
  toolConfig: ContentSections;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

interface SectionContext<Cap extends ContentSectionCapability> {
  section: ContentSection;
  cap: Cap;
  toolConfig: ContentSections;
}

interface ContentEntry {
  filePath: string;
  rawContent: string;
}

export class InstallContentSection<Cap extends ContentSectionCapability> {
  constructor(private readonly descriptor: ContentSectionDescriptor<Cap>) {}

  execute(options: InstallContentSectionCommand): InstallationFile[] {
    const { toolConfig, section, contentFiles } = options;
    const cap = this.descriptor.answersOf(toolConfig);
    if (cap === null) return [];
    const results: InstallationFile[] = [];
    for (const [filePath, rawContent] of contentFiles) {
      const file = this.processFile({ filePath, rawContent }, { section, cap, toolConfig });
      if (file !== null) results.push(file);
    }
    return results;
  }

  private processFile(entry: ContentEntry, context: SectionContext<Cap>): InstallationFile | null {
    const { filePath } = entry;
    const { section, cap } = context;
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
        hash: FileHash.of(""),
        frameworkPath: filePath,
      });
    }
    return this.buildFile(entry, { outputPath, relativeFileName }, context);
  }

  private buildFile(
    entry: ContentEntry,
    target: { outputPath: string; relativeFileName: string },
    context: SectionContext<Cap>
  ): InstallationFile {
    const { filePath, rawContent } = entry;
    const { outputPath, relativeFileName } = target;
    const { cap, toolConfig } = context;
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
      hash: FileHash.of(outputContent),
      frameworkPath: filePath,
    });
  }
}
