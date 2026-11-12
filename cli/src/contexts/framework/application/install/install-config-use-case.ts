import { join } from "node:path";
import { InstallationFile } from "../../../../kernel/file.js";
import type { AssetProvider } from "../../../../kernel/ports/asset-provider.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { Platform } from "../../../../runtime/platform/platform.js";
import { CONFIG_MCP, type ConfigRef } from "../../../tools/domain/capabilities/config-refs.js";
import { McpCapability } from "../../../tools/domain/capabilities/mcp-capability.js";
import { SettingsCapability } from "../../../tools/domain/capabilities/settings-capability.js";
import type { ConfigCapability } from "../../../tools/domain/contracts.js";
import { transformFor as transformMcpForPlatform } from "../../../tools/domain/mcp-launch-command.js";

interface InstallConfigOptions {
  capabilities: readonly ConfigCapability[];
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
    const { capabilities, configRefs, contentFiles, projectRoot, platform } = options;
    const win32Transform = transformMcpForPlatform(platform.current());
    const results: InstallationFile[] = [];
    for (const ref of configRefs) {
      const capability = capabilities.find((c) => c.consumes(ref.name));
      if (capability === undefined) continue;
      const file = await this.processRef(
        ref,
        capability,
        contentFiles,
        projectRoot,
        win32Transform
      );
      if (file !== null) results.push(file);
    }
    for (const capability of capabilities) {
      if (!(capability instanceof SettingsCapability)) continue;
      const file = await this.processStaticCapability(capability, projectRoot, options);
      if (file !== null) results.push(file);
    }
    return results;
  }

  private async processRef(
    ref: ConfigRef,
    capability: ConfigCapability,
    contentFiles: Map<string, string>,
    projectRoot: string,
    win32Transform: ((content: string) => string) | undefined
  ): Promise<InstallationFile | null> {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return null;
    const outputPath = await this.resolveCapabilityOutputPath(capability, projectRoot);
    if (outputPath === null) return null;
    const content = this.applyTransforms(capability, ref.name, rawContent, win32Transform);
    return new InstallationFile({
      relativePath: outputPath,
      content,
      hash: this.hasher.hash(content),
      mergeStrategy: capability.mergeStrategy(),
      frameworkPath: ref.path,
    });
  }

  private async processStaticCapability(
    capability: SettingsCapability,
    projectRoot: string,
    options: InstallConfigOptions
  ): Promise<InstallationFile | null> {
    const { assetProvider, toolId } = options;
    const content = capability.resolveStaticContent(
      assetProvider === undefined || toolId === undefined
        ? undefined
        : (fileName) => assetProvider.loadConfigAsset(toolId, fileName)
    );
    if (content === null) return null;
    const outputPath = await this.resolveCapabilityOutputPath(capability, projectRoot);
    if (outputPath === null) return null;
    return new InstallationFile({
      relativePath: outputPath,
      content,
      hash: this.hasher.hash(content),
      mergeStrategy: capability.mergeStrategy(),
    });
  }

  private async resolveCapabilityOutputPath(
    capability: ConfigCapability,
    projectRoot: string
  ): Promise<string | null> {
    if (capability instanceof McpCapability) {
      return capability.resolveOutputPath((relativePath) =>
        this.fs.fileExists(join(projectRoot, relativePath))
      );
    }
    return capability.outputPath();
  }

  private applyTransforms(
    capability: ConfigCapability,
    configName: string,
    rawContent: string,
    win32Transform: ((content: string) => string) | undefined
  ): string {
    const toolContent =
      capability instanceof McpCapability ? capability.transform(rawContent) : rawContent;
    const isMcp = capability.consumes(CONFIG_MCP) && configName === CONFIG_MCP;
    return isMcp && win32Transform ? win32Transform(toolContent) : toolContent;
  }
}
