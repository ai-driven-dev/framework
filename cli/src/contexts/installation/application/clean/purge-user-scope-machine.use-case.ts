import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope/user-scope-plugin-files.js";
import type { MachineStatePurge } from "../../ports/user-scope/user-scope-purge.js";
import { userPluginsOf } from "./user-plugins-of.js";

/** What PurgeUserScopeMachine is built from. */
export interface PurgeUserScopeMachineDeps {
  readonly userManifestRepo: ManifestRepository;
  readonly purgeMachineState: MachineStatePurge;
  /** The one resolver for the OS home directory a user-scope plugin's files sit under. */
  readonly homeDir: () => string;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
}

/** Removes the user plugin files, then the whitelisted machine state. */
export class PurgeUserScopeMachine {
  constructor(
    private readonly deps: PurgeUserScopeMachineDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(projectRoot: string): Promise<void> {
    const manifest = await this.deps.userManifestRepo.load();
    if (manifest !== null) await this.purgeUserPluginFiles(manifest, projectRoot);
    await this.deps.purgeMachineState.purge();
  }

  /** The one tree this whitelist purges outside `userConfigDir()` itself: a user-scope plugin's
   * own files, listed by the user manifest and never deleted without the containment check a
   * `..` segment a corrupted entry carries, or a plugin directory that became a symlink after
   * install, is left in place and named. */
  private async purgeUserPluginFiles(manifest: Manifest, projectRoot: string): Promise<void> {
    const home = this.deps.homeDir();
    for (const { toolId, plugin } of userPluginsOf(manifest, this.tools)) {
      const tool = this.tools.aiProfile(toolId);
      const files = await this.deps.userScopePluginFiles.proven(plugin, tool, home);
      await this.deps.userScopePluginFiles.remove(files, tool, { projectRoot, home });
    }
  }
}
