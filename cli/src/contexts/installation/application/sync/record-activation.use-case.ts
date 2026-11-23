import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import { driftOf } from "../../domain/drift.js";
import type { Manifest } from "../../domain/manifest.js";

/** A marketplace the host registered: the manifest reads the two names and keeps the rest. */
export type RegisteredMarketplace = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** What a run observed or caused. The answer says whether it changed a manifest. */
export interface RecordActivationRequest {
  readonly kind: "settings-written-by-host";
  readonly projectRoot: string;
  readonly manifest: Manifest;
  readonly activated: readonly ToolId[];
}

/** What RecordActivation is built from. */
export interface RecordActivationDeps {
  readonly fs: FileReader;
}

/** What a run observed or caused, written back into the manifests that track it. */
export class RecordActivation {
  constructor(
    private readonly deps: RecordActivationDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(request: RecordActivationRequest): Promise<boolean> {
    return this.recordWhatActivationWrote(request);
  }

  /**
   * A host's own CLI writes its registration into the very file `syncTool` had just hashed, so
   * the hash is re-read from disk after activation rather than re-derived: what is stored is
   * then the observation, not a guess at what the host would have written.
   */
  private async recordWhatActivationWrote({
    projectRoot,
    manifest,
    activated,
  }: RecordActivationRequest): Promise<boolean> {
    let changed = false;
    for (const toolId of activated) {
      if (await this.rehashHostSettings({ projectRoot, manifest }, toolId)) changed = true;
    }
    return changed;
  }

  private async rehashHostSettings(
    { projectRoot, manifest }: { projectRoot: string; manifest: Manifest },
    toolId: ToolId
  ): Promise<boolean> {
    const settingsPath = this.marketplaceSettingsOf(toolId)?.sharedSettingsFile();
    const tracked = manifest.getToolFiles(toolId).find((f) => f.relativePath === settingsPath);
    if (settingsPath === undefined || tracked === undefined) return false;
    const content = await this.deps.fs.readFileIfReadable(resolve(projectRoot, settingsPath));
    if (content === undefined) return false;
    const hash = FileHash.of(content);
    if (driftOf(tracked.hash.value, hash) === "ok") return false;
    manifest.recordFileHash(toolId, settingsPath, hash);
    return true;
  }

  private marketplaceSettingsOf(toolId: ToolId): MarketplaceRegistrationAnswers | undefined {
    return this.tools.aiProfileIfAny(toolId)?.marketplaceRegistration() ?? undefined;
  }
}
