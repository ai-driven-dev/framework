import { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { removeRedundantGitkeeps } from "../../../../shared/domain/redundant-gitkeeps.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { ContentSection, FrameworkDescriptor } from "../../domain/canon.js";
import type { Platform } from "../../ports/platform.js";
import type { RestoredAiTool, RestoredIdeTool, RestoredTool } from "../../ports/tool-sections.js";
import type { InstallContentSectionCommand } from "../install/content/install-content-section.js";
import type { InstallConfig } from "../install/install-config.js";

export interface ContentSectionInstaller {
  execute(command: InstallContentSectionCommand): InstallationFile[];
}

/** The installer of each content section, by section name. A section with none yields no files. */
export type ContentSectionInstallers = ReadonlyMap<string, ContentSectionInstaller>;

interface GenerateToolDistributionCommand {
  config: RestoredTool;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  projectRoot: string;
}

export class GenerateToolDistribution {
  constructor(
    private readonly installConfig: Pick<InstallConfig, "execute">,
    private readonly sectionInstallers: ContentSectionInstallers,
    private readonly platform: Platform,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(options: GenerateToolDistributionCommand): Promise<InstallationFile[]> {
    const { config } = options;
    if (config.kind !== "ai") return this.generateIdeToolFiles(config, options);
    return this.generateAiToolFiles(config, options);
  }

  private async generateIdeToolFiles(
    config: RestoredIdeTool,
    options: GenerateToolDistributionCommand
  ): Promise<InstallationFile[]> {
    const { descriptor, contentFiles, projectRoot } = options;
    const configFiles = await this.installConfig.execute({
      writes: config.configWrites(),
      configRefs: descriptor.configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
    });
    return removeRedundantGitkeeps(configFiles);
  }

  private async generateAiToolFiles(
    config: RestoredAiTool,
    options: GenerateToolDistributionCommand
  ): Promise<InstallationFile[]> {
    const { descriptor, contentFiles, projectRoot } = options;
    const sectionFiles = this.generateCapabilitySectionFiles(config, descriptor, contentFiles);
    const configFiles = await this.installConfig.execute({
      writes: config.configWrites(),
      configRefs: descriptor.configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
      assetProvider: this.assetProvider,
      toolId: config.toolId,
    });
    const outputPathFiles = this.buildConfigOutputPathFiles(config);
    return removeRedundantGitkeeps([...sectionFiles, ...configFiles, ...outputPathFiles]);
  }

  private buildConfigOutputPathFiles(config: RestoredAiTool): InstallationFile[] {
    if (this.assetProvider === undefined) return [];
    const outputPaths = config.configFiles();
    const files: InstallationFile[] = [];
    for (const [fileName, outputPath] of Object.entries(outputPaths)) {
      const asset = this.assetProvider.loadConfigAsset(config.toolId, fileName);
      const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      files.push(
        new InstallationFile({
          relativePath: outputPath,
          content,
          hash: FileHash.of(content),
        })
      );
    }
    return files;
  }

  private generateCapabilitySectionFiles(
    config: RestoredAiTool,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>
  ): InstallationFile[] {
    const results: InstallationFile[] = [];
    for (const section of descriptor.contentSections) {
      results.push(...this.generateSectionFiles(config, section, contentFiles));
    }
    return results;
  }

  private generateSectionFiles(
    config: RestoredAiTool,
    section: ContentSection,
    contentFiles: Map<string, string>
  ): InstallationFile[] {
    const options = { toolConfig: config, section, contentFiles };
    return this.sectionInstallers.get(section.name)?.execute(options) ?? [];
  }
}
