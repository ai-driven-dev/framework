import type { MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { TrackedConfigFiles } from "./config/tracked-config-files.use-case.js";
import type { RunPostInstallPipeline } from "./run-post-install-pipeline.use-case.js";

export interface PropagateAiSettingsToIdeRequest {
  ideId: IdeToolId;
  projectRoot: string;
}

/** What PropagateAiSettingsToIde is built from. */
export interface PropagateAiSettingsToIdeDeps {
  readonly manifestRepo: ManifestRepository;
  readonly trackedConfigFiles: TrackedConfigFiles;
  readonly runPostInstallPipeline: RunPostInstallPipeline;
  readonly assetProvider?: AssetProvider;
}

/** Writes the static settings that the installed AI tools require an IDE to hold, once that IDE is
 * installed. */
export class PropagateAiSettingsToIde {
  constructor(
    private readonly deps: PropagateAiSettingsToIdeDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: PropagateAiSettingsToIdeRequest): Promise<void> {
    const manifest = await this.deps.manifestRepo.load();
    if (manifest === null) return;
    for (const aiId of this.tools.idsInCanonicalOrder("ai")) {
      if (!manifest.hasTool(aiId)) continue;
      await this.mergeAiToolSettings(aiId, command, manifest);
    }
  }

  private async mergeAiToolSettings(
    aiId: AiToolId,
    { ideId, projectRoot }: PropagateAiSettingsToIdeRequest,
    manifest: Manifest
  ): Promise<void> {
    const toMerge = this.tools
      .aiProfile(aiId)
      .settingsFiles()
      .filter((cap) => cap.requires(ideId));
    let entries = [...manifest.getMergeFiles(aiId)];
    for (const cap of toMerge) {
      const [entry] = await this.deps.trackedConfigFiles.execute({
        kind: "merge-and-track",
        files: [cap.fileOf(this.resolveCapabilityContent(cap, aiId))],
        projectRoot,
      });
      entries = this.replacing(entries, entry);
      manifest.updateToolMergeFiles(aiId, entries);
      await this.deps.runPostInstallPipeline.execute({ projectRoot, manifest });
    }
  }

  private replacing(existing: MergeFileEntry[], entry: MergeFileEntry): MergeFileEntry[] {
    return [...existing.filter((e) => e.relativePath !== entry.relativePath), entry];
  }

  private resolveCapabilityContent(cap: SettingsFileAnswers, aiId: AiToolId): string {
    const provider = this.deps.assetProvider;
    return (
      cap.resolveStaticContent(
        provider === undefined ? undefined : (fileName) => provider.loadConfigAsset(aiId, fileName)
      ) ?? "{}"
    );
  }
}
