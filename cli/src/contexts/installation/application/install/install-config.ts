import { join } from "node:path";
import { FileHash, InstallationFile } from "../../../../shared/domain/file.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ConfigRef } from "../../../tools/contract/config-refs.js";
import type { ConfigWrite, SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";
import type { Platform } from "../../ports/platform.js";

interface InstallConfigCommand {
  writes: readonly ConfigWrite[];
  configRefs: readonly ConfigRef[];
  contentFiles: Map<string, string>;
  projectRoot: string;
  platform: Platform;
  assetProvider?: AssetProvider;
  toolId?: AiToolId;
}

export class InstallConfig {
  constructor(private readonly fs: FileReader) {}

  async execute(options: InstallConfigCommand): Promise<InstallationFile[]> {
    const { writes, configRefs, contentFiles, projectRoot, platform } = options;
    const platformName = platform.current();
    const results: InstallationFile[] = [];
    for (const ref of configRefs) {
      const write = writes.find((w) => w.capability.consumes(ref.name));
      if (write === undefined) continue;
      const file = await this.processRef(ref, write, contentFiles, projectRoot, platformName);
      if (file !== null) results.push(file);
    }
    for (const write of writes) {
      if (write.kind !== "settings") continue;
      const file = this.processStaticWrite(write.capability, options);
      if (file !== null) results.push(file);
    }
    return results;
  }

  private async processRef(
    ref: ConfigRef,
    write: ConfigWrite,
    contentFiles: Map<string, string>,
    projectRoot: string,
    platformName: string
  ): Promise<InstallationFile | null> {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return null;
    const outputPath = await this.resolveOutputPath(write, projectRoot);
    if (outputPath === null) return null;
    const content = this.applyTransforms(write, rawContent, platformName);
    return new InstallationFile({
      relativePath: outputPath,
      content,
      hash: FileHash.of(content),
      mergeStrategy: write.capability.mergeStrategy(),
      frameworkPath: ref.path,
    });
  }

  private processStaticWrite(
    capability: SettingsFileAnswers,
    options: InstallConfigCommand
  ): InstallationFile | null {
    const { assetProvider, toolId } = options;
    const content = capability.resolveStaticContent(
      assetProvider === undefined || toolId === undefined
        ? undefined
        : (fileName) => assetProvider.loadConfigAsset(toolId, fileName)
    );
    if (content === null) return null;
    return new InstallationFile({
      relativePath: capability.outputPath(),
      content,
      hash: FileHash.of(content),
      mergeStrategy: capability.mergeStrategy(),
    });
  }

  private async resolveOutputPath(write: ConfigWrite, projectRoot: string): Promise<string | null> {
    if (write.kind === "mcp") {
      return write.capability.resolveOutputPath((relativePath) =>
        this.fs.fileExists(join(projectRoot, relativePath))
      );
    }
    return write.capability.outputPath();
  }

  private applyTransforms(write: ConfigWrite, rawContent: string, platformName: string): string {
    if (write.kind !== "mcp") return rawContent;
    const toolContent = write.capability.transform(rawContent);
    const launch = write.capability.launchTransformFor(platformName);
    return launch ? launch(toolContent) : toolContent;
  }
}
