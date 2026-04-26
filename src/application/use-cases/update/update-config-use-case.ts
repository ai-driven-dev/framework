import { HooksCapability } from "../../../domain/capabilities/hooks-capability.js";
import { McpCapability } from "../../../domain/capabilities/mcp-capability.js";
import type { SettingsCapability } from "../../../domain/capabilities/settings-capability.js";
import { InstallationFile } from "../../../domain/models/file.js";
import type { ConfigRef } from "../../../domain/models/framework.js";
import { CONFIG_MCP } from "../../../domain/models/framework.js";
import { transformFor as transformMcpForPlatform } from "../../../domain/models/mcp-exclusion.js";
import type { MergeStrategy } from "../../../domain/models/merge.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Platform } from "../../../domain/ports/platform.js";
import type { ConfigCapability } from "../install/install-config-use-case.js";

interface UpdateConfigOptions {
  capabilities: readonly ConfigCapability[];
  configRefs: readonly ConfigRef[];
  contentFiles: Map<string, string>;
  projectRoot: string;
  platform: Platform;
}

export class UpdateConfigUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher
  ) {}

  async execute(options: UpdateConfigOptions): Promise<InstallationFile[]> {
    const { capabilities, configRefs, contentFiles, projectRoot, platform } = options;
    const win32Transform = transformMcpForPlatform(platform.current());
    const results: InstallationFile[] = [];
    for (const ref of configRefs) {
      const capability = capabilities.find((c) => c.consumes.includes(ref.name));
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
      mergeStrategy: this.getCapabilityMergeStrategy(capability),
      frameworkPath: ref.path,
    });
  }

  private async resolveCapabilityOutputPath(
    capability: ConfigCapability,
    projectRoot: string
  ): Promise<string | null> {
    if (capability instanceof McpCapability) {
      return capability.resolveOutput(projectRoot, this.fs);
    }
    return capability.buildOutputPath();
  }

  private applyTransforms(
    capability: ConfigCapability,
    configName: string,
    rawContent: string,
    win32Transform: ((content: string) => string) | undefined
  ): string {
    const toolContent =
      capability instanceof McpCapability ? capability.transform(rawContent) : rawContent;
    const isMcp = capability.consumes.includes(CONFIG_MCP) && configName === CONFIG_MCP;
    return isMcp && win32Transform ? win32Transform(toolContent) : toolContent;
  }

  private getCapabilityMergeStrategy(capability: ConfigCapability): MergeStrategy {
    if (capability instanceof McpCapability) {
      return capability.params.mergeStrategy ?? "user-prime";
    }
    if (capability instanceof HooksCapability) {
      return capability.getMergeStrategy();
    }
    return (capability as SettingsCapability).getMergeStrategy();
  }
}
