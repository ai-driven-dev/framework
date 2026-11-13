import type { VersionReader } from "../../../shared/ports/version-reader.js";
import { decideUpdate, type UpdateFlags } from "../domain/update-decision.js";
import type { CliInstaller } from "../ports/cli-installer.js";
import type { CliReleaseSource } from "../ports/cli-release-source.js";

export type SelfUpdateCommand = UpdateFlags;

export type SelfUpdateResult =
  | { kind: "up-to-date"; version: string }
  | { kind: "check-available"; latestVersion: string; currentVersion: string }
  | { kind: "check-current"; version: string }
  | { kind: "dry-run"; latestVersion: string }
  | { kind: "updated"; latestVersion: string; changelog: string | null; binaryPath: string };

export class SelfUpdate {
  constructor(
    private readonly releases: CliReleaseSource,
    private readonly installer: CliInstaller,
    private readonly version: VersionReader
  ) {}

  async execute(command: SelfUpdateCommand): Promise<SelfUpdateResult> {
    const currentVersion = this.version.get();
    const { version: latestVersion, changelog } = await this.releases.fetchLatestRelease();
    const decision = decideUpdate(currentVersion, latestVersion, command);
    switch (decision) {
      case "check-available":
        return { kind: "check-available", latestVersion, currentVersion };
      case "check-current":
        return { kind: "check-current", version: currentVersion };
      case "up-to-date":
        return { kind: "up-to-date", version: currentVersion };
      case "dry-run":
        return { kind: "dry-run", latestVersion };
      case "install":
        return {
          kind: "updated",
          latestVersion,
          changelog,
          binaryPath: this.installer.install(),
        };
    }
  }
}
