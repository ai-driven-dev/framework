import { join } from "node:path";
import { InstallationFile } from "../../../../kernel/file.js";
import type { AssetProvider } from "../../../../kernel/ports/asset-provider.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { Platform } from "../../../../runtime/platform/platform.js";
import { CONFIG_MCP, type ConfigRef } from "../../../tools/contract/config-refs.js";
import type { ConfigWrite, SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";

interface McpServerWin32 {
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

interface McpConfigWin32 {
  mcpServers?: Record<string, McpServerWin32>;
  [key: string]: unknown;
}

function transformMcpForWin32(content: string): string {
  const config = JSON.parse(content) as McpConfigWin32;
  if (!config.mcpServers) return JSON.stringify(config, null, 2);
  for (const server of Object.values(config.mcpServers)) {
    if (server.command === "npx") {
      server.args = ["/c", "npx", ...(server.args ?? [])];
      server.command = "cmd";
    } else if (server.command === "uvx") {
      server.command = "uvx.exe";
    } else if (server.command === "uv") {
      server.command = "uv.exe";
    }
  }
  return JSON.stringify(config, null, 2);
}

export function transformMcpForPlatform(
  platform: string
): ((content: string) => string) | undefined {
  return platform === "win32" ? transformMcpForWin32 : undefined;
}

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
    const win32Transform = transformMcpForPlatform(platform.current());
    const results: InstallationFile[] = [];
    for (const ref of configRefs) {
      const write = writes.find((w) => w.capability.consumes(ref.name));
      if (write === undefined) continue;
      const file = await this.processRef(ref, write, contentFiles, projectRoot, win32Transform);
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
    win32Transform: ((content: string) => string) | undefined
  ): Promise<InstallationFile | null> {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return null;
    const outputPath = await this.resolveOutputPath(write, projectRoot);
    if (outputPath === null) return null;
    const content = this.applyTransforms(write, ref.name, rawContent, win32Transform);
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
    win32Transform: ((content: string) => string) | undefined
  ): string {
    const toolContent = write.kind === "mcp" ? write.capability.transform(rawContent) : rawContent;
    const isMcp = write.capability.consumes(CONFIG_MCP) && configName === CONFIG_MCP;
    return isMcp && win32Transform ? win32Transform(toolContent) : toolContent;
  }
}
