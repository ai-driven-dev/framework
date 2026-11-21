import type { MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { TrackedConfigFiles } from "./config/tracked-config-files.js";
import type { RunPostInstallPipeline } from "./run-post-install-pipeline.js";

export interface PropagateAiSettingsToIdeCommand {
  ideId: IdeToolId;
  projectRoot: string;
}

/** Writes the static settings that the installed AI tools require an IDE to hold, once that IDE is
 * installed. */
export class PropagateAiSettingsToIde {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly trackedConfigFiles: TrackedConfigFiles,
    private readonly runPostInstallPipeline: RunPostInstallPipeline,
    /** The AI tools, in the order their settings are written, and what each declares. */
    private readonly tools: ToolCatalog,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(command: PropagateAiSettingsToIdeCommand): Promise<void> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return;
    for (const aiId of this.tools.idsInCanonicalOrder("ai")) {
      if (!manifest.hasTool(aiId)) continue;
      await this.mergeAiToolSettings(aiId, command, manifest);
    }
  }

  private async mergeAiToolSettings(
    aiId: AiToolId,
    { ideId, projectRoot }: PropagateAiSettingsToIdeCommand,
    manifest: Manifest
  ): Promise<void> {
    const toMerge = this.tools
      .aiProfile(aiId)
      .settingsFiles()
      .filter((cap) => cap.requires(ideId));
    const existingEntries = [...manifest.getMergeFiles(aiId)];
    for (const cap of toMerge) {
      const [entry] = await this.trackedConfigFiles.mergeAndTrack(
        [cap.fileOf(this.resolveCapabilityContent(cap, aiId))],
        projectRoot
      );
      manifest.updateToolMergeFiles(aiId, this.replacing(existingEntries, entry));
      await this.runPostInstallPipeline.execute({ projectRoot, manifest });
    }
  }

  private replacing(existing: MergeFileEntry[], entry: MergeFileEntry): MergeFileEntry[] {
    return [...existing.filter((e) => e.relativePath !== entry.relativePath), entry];
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
