import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** What a command reads of the machine's installation record: the tools registered at user
 * scope, the version each was installed at, and whether one holds a user-scope plugin. Opaque on
 * purpose: the manifest itself stays inside installation. */
export interface MachineInstallationView {
  readonly toolIds: readonly string[];
  versionOf(toolId: string): string | undefined;
  hasUserPlugins(toolId: string): boolean;
}

/** The machine's installation record as a command shows it, or `null` when nothing is registered
 * at user scope yet. */
export class ReadMachineInstallation {
  constructor(private readonly userManifestRepo: Pick<ManifestRepository, "load">) {}

  async execute(): Promise<MachineInstallationView | null> {
    const manifest = await this.userManifestRepo.load();
    if (manifest === null) return null;
    return {
      toolIds: manifest.getInstalledToolIds(),
      versionOf: (toolId) => manifest.getToolVersion(toolId),
      hasUserPlugins: (toolId) =>
        manifest.getPlugins(toolId).some((plugin) => plugin.scope === "user"),
    };
  }
}
