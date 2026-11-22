import type { ReadMachineInstallation } from "../../contexts/installation/application/doctor/read-machine-installation.use-case.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { SyncSettingsResult } from "../domain/sync-settings.model.js";
import { SyncFailedError, UserScopeFilterUnsupportedError } from "../orchestration.error.js";
import type { UpdateUserPlugin } from "../plugin/update-user-plugin.use-case.js";
import type { SyncSettings } from "./settings/sync-settings.use-case.js";

export interface RunUserScopeSyncRequest {
  projectRoot: string;
  tool?: string;
  plugin?: string;
  files: readonly string[];
}

export interface RunUserScopeSyncReport {
  activated(activation: SyncSettingsResult): void;
  synced(synced: { activated: readonly string[]; refreshed: readonly string[] }): void;
}

export interface RunUserScopeSyncDeps {
  readonly machine: Pick<ReadMachineInstallation, "execute">;
  readonly userPlugins: Pick<UpdateUserPlugin, "execute">;
  readonly syncSettings: Pick<SyncSettings, "execute">;
}

/** A user-scope install writes nothing under any project, so this skips the project restore: it
 * rebuilds the global files aidd copied into each tool's user directory from the shared source,
 * then drives native activation, through the machine's installation and never this project's own
 * manifest. */
export class RunUserScopeSync {
  constructor(
    private readonly deps: RunUserScopeSyncDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: RunUserScopeSyncRequest, report: RunUserScopeSyncReport): Promise<void> {
    const { projectRoot, tool, plugin, files } = command;
    // Neither has a user-scope counterpart, so both are refused rather than read and
    // silently discarded.
    if (plugin !== undefined) {
      throw new UserScopeFilterUnsupportedError("--plugin", "sync --plugin <name>");
    }
    if (files.length > 0) {
      throw new UserScopeFilterUnsupportedError("a file argument", "sync <files...>");
    }
    // An editor or an unknown name owns no user-scope file and no native activation, so it
    // narrows the run to nothing instead of failing it.
    const aiToolIds = (names: readonly string[]) =>
      names.flatMap((name) => this.tools.aiToolId(name) ?? []);
    const toolIds = tool === undefined ? undefined : aiToolIds([tool]);
    const machine = await this.deps.machine.execute();
    const withFiles = (toolIds ?? aiToolIds(machine?.toolIds ?? [])).filter((id) =>
      machine?.hasUserPlugins(id)
    );
    const refreshed =
      withFiles.length === 0
        ? []
        : await this.deps.userPlugins.execute({
            toolIds: withFiles,
            projectRoot,
            scope: "user",
            rebuild: true,
          });
    const activation = await this.deps.syncSettings.execute({
      projectRoot,
      scope: "user",
      toolIds,
      recreateFrameworkIfMissing: true,
    });
    report.activated(activation);
    if (activation.failed) throw new SyncFailedError(activation.errors);
    report.synced({ activated: activation.activated, refreshed: [...new Set(refreshed)] });
  }
}
