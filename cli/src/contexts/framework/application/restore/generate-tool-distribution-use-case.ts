import { InstallationFile, removeRedundantGitkeeps } from "../../../../kernel/file.js";
import type { AssetProvider } from "../../../../kernel/ports/asset-provider.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { Platform } from "../../../../shared/ports/platform.js";
import type { AiToolProfile, ToolProfile } from "../../../tools/contract/tool-profile.js";
import type { ContentSection, FrameworkDescriptor } from "../../../translate/domain/canon.js";
import { InstallAgentsUseCase } from "../install/content/install-agents-use-case.js";
import { InstallCommandsUseCase } from "../install/content/install-commands-use-case.js";
import { InstallRulesUseCase } from "../install/content/install-rules-use-case.js";
import { InstallSkillsUseCase } from "../install/content/install-skills-use-case.js";
import { InstallConfigUseCase } from "../install/install-config-use-case.js";

interface GenerateToolDistributionOptions {
  config: ToolProfile;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  projectRoot: string;
}

export class GenerateToolDistributionUseCase {
  constructor(
    private readonly fs: FileReader,
    private readonly hasher: Hasher,
    private readonly platform: Platform,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(options: GenerateToolDistributionOptions): Promise<InstallationFile[]> {
    const { config, descriptor, contentFiles, projectRoot } = options;
    if (config.kind !== "ai") {
      return this.generateIdeToolFiles(config, descriptor, contentFiles, projectRoot);
    }
    return this.generateAiToolFiles(config, descriptor, contentFiles, projectRoot);
  }

  private async generateIdeToolFiles(
    config: ToolProfile,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const configFiles = await new InstallConfigUseCase(this.fs, this.hasher).execute({
      writes: config.configWrites(),
      configRefs: descriptor.configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
    });
    return removeRedundantGitkeeps(configFiles);
  }

  private async generateAiToolFiles(
    config: AiToolProfile,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const sectionFiles = this.generateCapabilitySectionFiles(config, descriptor, contentFiles);
    const configFiles = await new InstallConfigUseCase(this.fs, this.hasher).execute({
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

  private buildConfigOutputPathFiles(config: AiToolProfile): InstallationFile[] {
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
          hash: this.hasher.hash(content),
        })
      );
    }
    return files;
  }

  private generateCapabilitySectionFiles(
    config: AiToolProfile,
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
    config: AiToolProfile,
    section: ContentSection,
    contentFiles: Map<string, string>
  ): InstallationFile[] {
    const options = { toolConfig: config, section, contentFiles };
    switch (section.name) {
      case "agents":
        return new InstallAgentsUseCase(this.hasher).execute(options);
      case "commands":
        return new InstallCommandsUseCase(this.hasher).execute(options);
      case "rules":
        return new InstallRulesUseCase(this.hasher).execute(options);
      case "skills":
        return new InstallSkillsUseCase(this.hasher).execute(options);
      default:
        return [];
    }
  }
}
