import {
  FileHash,
  InstallationFile,
  removeRedundantGitkeeps,
} from "../../../../shared/domain/file.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ContentSection, FrameworkDescriptor } from "../../domain/canon.js";
import type { Platform } from "../../ports/platform.js";
import type { RestoredAiTool, RestoredIdeTool, RestoredTool } from "../../ports/tool-sections.js";
import { InstallAgents } from "../install/content/install-agents.js";
import { InstallCommands } from "../install/content/install-commands.js";
import { InstallRules } from "../install/content/install-rules.js";
import { InstallSkills } from "../install/content/install-skills.js";
import { InstallConfig } from "../install/install-config.js";

interface GenerateToolDistributionCommand {
  config: RestoredTool;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  projectRoot: string;
}

export class GenerateToolDistribution {
  constructor(
    private readonly fs: FileReader,
    private readonly platform: Platform,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(options: GenerateToolDistributionCommand): Promise<InstallationFile[]> {
    const { config, descriptor, contentFiles, projectRoot } = options;
    if (config.kind !== "ai") {
      return this.generateIdeToolFiles(config, descriptor, contentFiles, projectRoot);
    }
    return this.generateAiToolFiles(config, descriptor, contentFiles, projectRoot);
  }

  private async generateIdeToolFiles(
    config: RestoredIdeTool,
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const configFiles = await new InstallConfig(this.fs).execute({
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
    descriptor: FrameworkDescriptor,
    contentFiles: Map<string, string>,
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const sectionFiles = this.generateCapabilitySectionFiles(config, descriptor, contentFiles);
    const configFiles = await new InstallConfig(this.fs).execute({
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
    switch (section.name) {
      case "agents":
        return new InstallAgents().execute(options);
      case "commands":
        return new InstallCommands().execute(options);
      case "rules":
        return new InstallRules().execute(options);
      case "skills":
        return new InstallSkills().execute(options);
      default:
        return [];
    }
  }
}
