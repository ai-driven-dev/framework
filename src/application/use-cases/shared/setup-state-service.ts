import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import {
  getAllRegisteredTools,
  hasToolSignals,
  type ToolId,
} from "../../../domain/tools/registry.js";

export type AdoptSignal = { type: "toolSignal"; tool: ToolId; file: string };

export type SetupState =
  | { kind: "needs-init" }
  | { kind: "needs-adopt"; signals: AdoptSignal[] }
  | { kind: "needs-install" }
  | { kind: "needs-update"; currentVersion: string; latestVersion: string }
  | { kind: "up-to-date" };

export class SetupStateService {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly fs: FileSystem
  ) {}

  async detect(projectRoot: string): Promise<SetupState> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return this.detectWithoutManifest(projectRoot);
    const installedIds = manifest.getInstalledToolIds();
    if (installedIds.length === 0) return { kind: "needs-install" };
    return { kind: "up-to-date" };
  }

  private async detectWithoutManifest(projectRoot: string): Promise<SetupState> {
    const signals: AdoptSignal[] = [];
    for (const [id, tool] of getAllRegisteredTools()) {
      for (const file of await hasToolSignals(this.fs, tool, projectRoot)) {
        signals.push({ type: "toolSignal", tool: id, file });
      }
    }
    if (signals.length > 0) return { kind: "needs-adopt", signals };
    return { kind: "needs-init" };
  }
}
