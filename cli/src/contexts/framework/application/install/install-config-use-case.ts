import { join } from "node:path";
import { InstallationFile } from "../../../../kernel/file.js";
import type { AssetProvider } from "../../../../kernel/ports/asset-provider.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import { CONFIG_MCP, type ConfigRef } from "../../../tools/contract/config-refs.js";
import type { ConfigWrite, SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";
import type { Platform } from "../../domain/ports/platform.js";

interface InstallConfigOptions {
  writes: readonly ConfigWrite[];
  configRefs: readonly ConfigRef[];
  contentFiles: Map<string, string>;
  projectRoot: string;
  platform: Platform;
  assetProvider?: AssetProvider;
  toolId?: AiToolId;
}

export class InstallConfigUseCase {
  constructor(
    private readonly fs: FileReader,
    private readonly hasher: Hasher
  ) {}

  async execute(options: InstallConfigOptions): Promise<InstallationFile[]> {
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
    const content = this.applyTransforms(write, ref.name, rawContent, platformName);
    return new InstallationFile({
      relativePath: outputPath,
      content,
      hash: this.hasher.hash(content),
      mergeStrategy: write.capability.mergeStrategy(),
      frameworkPath: ref.path,
    });
  }

  private processStaticWrite(
    capability: SettingsFileAnswers,
    options: InstallConfigOptions
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
      hash: this.hasher.hash(content),
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

  private applyTransforms(
    write: ConfigWrite,
    configName: string,
    rawContent: string,
    platformName: string
  ): string {
    if (write.kind !== "mcp") return rawContent;
    const toolContent = write.capability.transform(rawContent);
    const launch = write.capability.launchTransformFor(platformName);
    return configName === CONFIG_MCP && launch ? launch(toolContent) : toolContent;
  }
}
