import { basename, join } from "node:path";
import type { SettingsCapability } from "../../../domain/capabilities/settings-capability.js";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { DOCS_DIR } from "../../../domain/models/paths.js";
import type { IdeToolId } from "../../../domain/models/tool-ids.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { getToolConfig } from "../../../domain/tools/registry.js";
import { PostInstallPipelineUseCase } from "../shared/post-install-pipeline-use-case.js";

export interface InstallIdeConfigOptions {
  toolId: IdeToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
}

export interface InstallIdeConfigResult {
  toolId: IdeToolId;
  fileCount: number;
  files: InstallationFile[];
  skipped: boolean;
  warnings: string[];
}

export class InstallIdeConfigUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly assets: AssetProvider
  ) {}

  async execute(options: InstallIdeConfigOptions): Promise<InstallIdeConfigResult> {
    const { toolId, manifest, force } = options;
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }
    const files = await this.buildSettingsFiles(options);
    await this.writeFiles(files, options.projectRoot);
    manifest.addTool(toolId, options.version, files);
    await new PostInstallPipelineUseCase(this.fs, this.manifestRepo).execute({
      projectRoot: options.projectRoot,
      manifest,
      docsDir: DOCS_DIR,
    });
    return { toolId, fileCount: files.length, files, skipped: false, warnings: [] };
  }

  private async buildSettingsFiles(options: InstallIdeConfigOptions): Promise<InstallationFile[]> {
    const toolConfig = getToolConfig(options.toolId);
    if (!("settings" in toolConfig)) return [];
    const raw = toolConfig.settings as SettingsCapability | SettingsCapability[];
    const capabilities = Array.isArray(raw) ? raw : [raw];
    const files: InstallationFile[] = [];
    for (const capability of capabilities) {
      const file = await this.buildSettingsFile(capability, options);
      if (file !== null) files.push(file);
    }
    return files;
  }

  private async buildSettingsFile(
    capability: SettingsCapability,
    options: InstallIdeConfigOptions
  ): Promise<InstallationFile | null> {
    const outputPath = capability.buildOutputPath();
    if (await this.isUserOwned(outputPath, options)) return null;
    const fileName = basename(outputPath);
    const asset = this.assets.loadConfigAsset(options.toolId, fileName);
    const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
    return new InstallationFile({
      relativePath: outputPath,
      content,
      hash: this.hasher.hash(content),
    });
  }

  private async isUserOwned(
    relativePath: string,
    options: InstallIdeConfigOptions
  ): Promise<boolean> {
    const fullPath = join(options.projectRoot, relativePath);
    if (!(await this.fs.fileExists(fullPath))) return false;
    if (options.manifest.isFileTracked(relativePath)) return false;
    this.logger.warn(`Skipping ${relativePath} — exists but not tracked by aidd`);
    return true;
  }

  private async writeFiles(files: InstallationFile[], projectRoot: string): Promise<void> {
    for (const file of files) {
      await this.fs.writeFile(join(projectRoot, file.relativePath), file.content);
    }
  }
}
