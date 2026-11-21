import { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { removeRedundantGitkeeps } from "../../../../shared/domain/redundant-gitkeeps.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { ConfigRef } from "../../../tools/contract/config-refs.js";
import type { Platform } from "../../ports/platform.js";
import type { RestoredAiTool, RestoredIdeTool, RestoredTool } from "../../ports/tool-sections.js";
import type { InstallConfig } from "../install/install-config.use-case.js";

interface GenerateToolDistributionRequest {
  config: RestoredTool;
  configRefs: readonly ConfigRef[];
  contentFiles: Map<string, string>;
  projectRoot: string;
}

export class GenerateToolDistribution {
  constructor(
    private readonly installConfig: Pick<InstallConfig, "execute">,
    private readonly platform: Platform,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(options: GenerateToolDistributionRequest): Promise<InstallationFile[]> {
    const { config } = options;
    if (config.kind !== "ai") return this.generateIdeToolFiles(config, options);
    return this.generateAiToolFiles(config, options);
  }

  private async generateIdeToolFiles(
    config: RestoredIdeTool,
    options: GenerateToolDistributionRequest
  ): Promise<InstallationFile[]> {
    const { configRefs, contentFiles, projectRoot } = options;
    const configFiles = await this.installConfig.execute({
      writes: config.configWrites(),
      configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
    });
    return removeRedundantGitkeeps(configFiles);
  }

  private async generateAiToolFiles(
    config: RestoredAiTool,
    options: GenerateToolDistributionRequest
  ): Promise<InstallationFile[]> {
    const { configRefs, contentFiles, projectRoot } = options;
    const configFiles = await this.installConfig.execute({
      writes: config.configWrites(),
      configRefs,
      contentFiles,
      projectRoot,
      platform: this.platform,
      assetProvider: this.assetProvider,
      toolId: config.toolId,
    });
    const outputPathFiles = this.buildConfigOutputPathFiles(config);
    return removeRedundantGitkeeps([...configFiles, ...outputPathFiles]);
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
}
