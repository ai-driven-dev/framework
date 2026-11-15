import { join } from "node:path";
import { extractMergeEntries, type MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { FileMerger } from "../../ports/file-merger.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { InstallIdeConfig, InstallIdeConfigResult } from "./install-ide-config.js";
import type { RunPostInstallPipeline } from "./run-post-install-pipeline.js";

export interface InstallIdeToolCommand {
  toolId: IdeToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
  tools: ToolCatalog;
}

export class InstallIdeTool {
  constructor(
    private readonly installIdeConfig: InstallIdeConfig,
    private readonly manifestRepo: ManifestRepository,
    private readonly fs: FileReader & FileWriter & FileMerger,
    private readonly hasher: Hasher,
    private readonly runPostInstallPipeline: RunPostInstallPipeline,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(options: InstallIdeToolCommand): Promise<InstallIdeConfigResult> {
    const result = await this.installIdeConfig.execute(options);
    if (result.skipped) return result;
    await this.propagateAiStaticSettings(options.toolId, options.projectRoot, options.tools);
    return result;
  }

  private async propagateAiStaticSettings(
    ideId: IdeToolId,
    projectRoot: string,
    tools: ToolCatalog
  ): Promise<void> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return;
    for (const aiId of tools.idsInCanonicalOrder("ai")) {
      if (!manifest.hasTool(aiId)) continue;
      await this.mergeAiToolSettings(aiId, ideId, projectRoot, manifest, tools);
    }
  }

  private async mergeAiToolSettings(
    aiId: AiToolId,
    ideId: IdeToolId,
    projectRoot: string,
    manifest: Manifest,
    tools: ToolCatalog
  ): Promise<void> {
    const toMerge = tools
      .aiProfile(aiId)
      .settingsFiles()
      .filter((c) => c.requiredTool() === ideId);
    if (toMerge.length === 0) return;
    const existingEntries = [...manifest.getMergeFiles(aiId)];
    for (const cap of toMerge) {
      await this.mergeAndTrack(cap, projectRoot, aiId, existingEntries, manifest, tools);
    }
  }

  private async mergeAndTrack(
    cap: SettingsFileAnswers,
    projectRoot: string,
    aiId: AiToolId,
    existingEntries: MergeFileEntry[],
    manifest: Manifest,
    tools: ToolCatalog
  ): Promise<void> {
    const fullPath = join(projectRoot, cap.outputPath());
    const content = this.resolveCapabilityContent(cap, aiId);
    await this.fs.mergeJsonFile(fullPath, content, cap.mergeStrategy());
    const diskContent = await this.fs.readFile(fullPath);
    const hashes = extractMergeEntries(diskContent, null, this.hasher);
    const newEntry: MergeFileEntry = {
      relativePath: cap.outputPath(),
      sectionKey: null,
      entries: hashes,
    };
    const updated = [
      ...existingEntries.filter((e) => e.relativePath !== cap.outputPath()),
      newEntry,
    ];
    manifest.updateToolMergeFiles(aiId, updated);
    await this.runPostInstallPipeline.execute({
      projectRoot,
      manifest,
      tools,
    });
  }

  private resolveCapabilityContent(cap: SettingsFileAnswers, aiId: AiToolId): string {
    const provider = this.assetProvider;
    return (
      cap.resolveStaticContent(
        provider === undefined ? undefined : (fileName) => provider.loadConfigAsset(aiId, fileName)
      ) ?? "{}"
    );
  }
}
