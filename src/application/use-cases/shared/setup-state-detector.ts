import { compareSemver, isSemver } from "../../../domain/models/semver.js";
import {
  getAllRegisteredTools,
  hasToolSignals,
  type ToolId,
} from "../../../domain/models/tool-config.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { FrameworkResolver } from "../../../domain/ports/framework-resolver.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";

export type AdoptSignal = { type: "toolSignal"; tool: ToolId; file: string };

export type SetupState =
  | { kind: "needs-init" }
  | { kind: "needs-adopt"; signals: AdoptSignal[] }
  | { kind: "needs-install" }
  | { kind: "needs-update"; currentVersion: string; latestVersion: string }
  | { kind: "up-to-date" };

export class SetupStateDetector {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly fs: FileSystem,
    private readonly resolver: FrameworkResolver
  ) {}

  async detect(projectRoot: string): Promise<SetupState> {
    const manifest = await this.manifestRepo.load();

    if (manifest === null) {
      return this.detectWithoutManifest(projectRoot);
    }

    const installedIds = manifest.getInstalledToolIds();
    if (installedIds.length === 0) {
      return { kind: "needs-install" };
    }

    return this.detectUpdateState(manifest, installedIds);
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

  private async detectUpdateState(
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    installedIds: ToolId[]
  ): Promise<SetupState> {
    try {
      const latestVersion = await this.resolver.fetchLatestVersion(manifest.repo);
      const installedVersions = installedIds
        .map((id) => manifest.getToolVersion(id))
        .filter((v): v is string => v !== undefined);
      const currentVersion = installedVersions[0] ?? "unknown";
      const needsUpdate =
        isSemver(latestVersion) &&
        installedVersions.some((v) => !isSemver(v) || compareSemver(v, latestVersion) < 0);
      if (needsUpdate) {
        return { kind: "needs-update", currentVersion, latestVersion };
      }
    } catch {
      // Network failure → treat as up-to-date
    }
    return { kind: "up-to-date" };
  }
}
