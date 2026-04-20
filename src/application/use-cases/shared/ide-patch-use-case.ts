import { join } from "node:path";
import { generateDistribution } from "../../../domain/models/distribution.js";
import type { FrameworkDescriptor } from "../../../domain/models/framework-descriptor.js";
import type { GeneratedFile } from "../../../domain/models/generated-file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { MergeFileEntry } from "../../../domain/models/merge-entry.js";
import {
  buildConfigNameLookup,
  buildMergeFileEntries,
} from "../../../domain/models/merge-entry.js";
import {
  AI_TOOL_IDS,
  type AiToolId,
  getToolConfig,
  type IdeToolId,
  isAiToolConfig,
  type ToolId,
} from "../../../domain/models/tool-config.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Platform } from "../../../domain/ports/platform.js";

interface IdePatchOptions {
  newIdeIds: readonly IdeToolId[];
  installingIds: readonly ToolId[];
  manifest: Manifest;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  docsDir: string;
  projectRoot: string;
}

export class IdePatchUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly platform: Platform
  ) {}

  async execute(options: IdePatchOptions): Promise<void> {
    const alreadyInstalledAiIds = options.manifest
      .getInstalledToolIds()
      .filter(
        (id): id is AiToolId =>
          (AI_TOOL_IDS as readonly string[]).includes(id) && !options.installingIds.includes(id)
      );
    for (const toolId of alreadyInstalledAiIds) {
      await this.patchOneTool(toolId, options);
    }
  }

  private async patchOneTool(toolId: AiToolId, options: IdePatchOptions): Promise<void> {
    const { newIdeIds, manifest, descriptor, contentFiles, docsDir, projectRoot } = options;
    const config = getToolConfig(toolId);
    if (!isAiToolConfig(config)) return;
    if (!config.requiredIdeIds?.some((id) => (newIdeIds as string[]).includes(id))) return;
    const generated = await generateDistribution(
      descriptor,
      config,
      docsDir,
      contentFiles,
      this.hasher,
      this.platform,
      projectRoot,
      this.fs
    );
    await this.writeIdeFiles(generated, projectRoot, manifest);
    this.appendMergeEntries(toolId, generated, config.config(), descriptor.configRefs, manifest);
  }

  private async writeIdeFiles(
    files: GeneratedFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<void> {
    for (const file of files) {
      const outputPath = join(projectRoot, file.relativePath);
      if (file.mergeStrategy !== "none") {
        await this.fs.mergeJsonFile(outputPath, file.content, file.mergeStrategy);
        continue;
      }
      if ((await this.fs.fileExists(outputPath)) && !manifest.isFileTracked(file.relativePath)) {
        continue;
      }
      await this.fs.writeFile(outputPath, file.content);
    }
  }

  private appendMergeEntries(
    toolId: AiToolId,
    files: GeneratedFile[],
    configHandler: ReturnType<ReturnType<typeof getToolConfig>["config"]>,
    configRefs: FrameworkDescriptor["configRefs"],
    manifest: Manifest
  ): void {
    const newEntries = buildMergeFileEntries(
      files,
      configHandler,
      buildConfigNameLookup(configRefs),
      this.hasher
    );
    const existing = manifest.getMergeFiles(toolId);
    const existingPaths = new Set(existing.map((m) => m.relativePath));
    const toAdd = newEntries.filter((m) => !existingPaths.has(m.relativePath));
    if (toAdd.length > 0) {
      manifest.updateToolMergeFiles(toolId, [...existing, ...toAdd] as MergeFileEntry[]);
    }
  }
}
