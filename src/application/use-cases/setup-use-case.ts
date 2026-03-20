import type { Manifest } from "../../domain/models/manifest.js";
import { compareSemver, isSemver } from "../../domain/models/semver.js";
import { getAllRegisteredTools, hasToolSignals } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

interface SetupOptions {
  projectRoot: string;
}

export type SetupState =
  | { kind: "needs-init" }
  | { kind: "needs-adopt" }
  | { kind: "needs-install"; manifest: Manifest }
  | { kind: "needs-update"; currentVersion: string; latestVersion: string; manifest: Manifest }
  | { kind: "up-to-date" };

export class SetupUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly fs: FileSystem,
    private readonly resolver: FrameworkResolver
  ) {}

  async execute(options: SetupOptions): Promise<SetupState> {
    const { projectRoot } = options;
    const manifest = await this.manifestRepo.load();

    if (manifest === null) {
      const hasSignals = await this.hasAiddSignals(projectRoot);
      return hasSignals ? { kind: "needs-adopt" } : { kind: "needs-init" };
    }

    const installedIds = manifest.getInstalledToolIds();
    if (installedIds.length === 0) {
      return { kind: "needs-install", manifest };
    }

    try {
      const latestVersion = await this.resolver.fetchLatestVersion();
      const installedVersions = installedIds
        .map((id) => manifest.getToolVersion(id))
        .filter((v): v is string => v !== undefined);
      const currentVersion = installedVersions[0] ?? "unknown";
      const needsUpdate =
        isSemver(latestVersion) &&
        installedVersions.some((v) => !isSemver(v) || compareSemver(v, latestVersion) < 0);
      if (needsUpdate) {
        return { kind: "needs-update", currentVersion, latestVersion, manifest };
      }
    } catch {
      // Network failure → treat as up-to-date (consistent with status behavior)
    }

    return { kind: "up-to-date" };
  }

  private async hasAiddSignals(projectRoot: string): Promise<boolean> {
    for (const tool of getAllRegisteredTools().values()) {
      if (await hasToolSignals(this.fs, tool, projectRoot)) return true;
    }
    return false;
  }
}
