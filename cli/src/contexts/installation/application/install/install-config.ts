import { join } from "node:path";
import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
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
    return [...(await this.referencedFiles(options)), ...this.staticFiles(options)];
  }

  private async referencedFiles(options: InstallConfigCommand): Promise<InstallationFile[]> {
    const { writes, configRefs, contentFiles, projectRoot, platform } = options;
    const platformName = platform.current();
    const results: InstallationFile[] = [];
    for (const ref of configRefs) {
      const write = writes.find((w) => w.capability.consumes(ref.name));
      if (write === undefined) continue;
      const file = await this.processRef(ref, write, { contentFiles, projectRoot, platformName });
      if (file !== null) results.push(file);
    }
    return results;
  }

  private staticFiles(options: InstallConfigCommand): InstallationFile[] {
    const files: InstallationFile[] = [];
    for (const write of options.writes) {
      if (write.kind !== "settings") continue;
      const file = this.processStaticWrite(write.capability, options);
      if (file !== null) files.push(file);
    }
    return files;
  }

  private async processRef(
    ref: ConfigRef,
    write: ConfigWrite,
    context: { contentFiles: Map<string, string>; projectRoot: string; platformName: string }
  ): Promise<InstallationFile | null> {
    const { contentFiles, projectRoot, platformName } = context;
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return null;
    const relativePath = await this.resolveOutputPath(write, projectRoot);
    const content = this.applyTransforms(write, rawContent, platformName);
    return write.capability.fileOf(content, { relativePath, frameworkPath: ref.path });
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
    return capability.fileOf(content);
  }

  /** The mcp file a project already keeps, or undefined for a file that lands at its own path. */
  private async resolveOutputPath(
    write: ConfigWrite,
    projectRoot: string
  ): Promise<string | undefined> {
    if (write.kind !== "mcp") return undefined;
    return write.capability.resolveOutputPath((relativePath) =>
      this.fs.fileExists(join(projectRoot, relativePath))
    );
  }

  private applyTransforms(write: ConfigWrite, rawContent: string, platformName: string): string {
    if (write.kind !== "mcp") return rawContent;
    const toolContent = write.capability.transform(rawContent);
    const launch = write.capability.launchTransformFor(platformName);
    return launch ? launch(toolContent) : toolContent;
  }
}
