import type { RestoreTool } from "../../contexts/installation/application/restore/project/restore-tool.js";
import type { SyncSettingsResult } from "../domain/sync-settings.model.js";
import type { RestoreAll, RestoreAllResult } from "../global/restore-all.js";
import { SyncFailedError } from "../orchestration.error.js";
import type { SyncSettings } from "./sync-settings.js";

type ToolRestoreResult = Awaited<ReturnType<RestoreTool["execute"]>>;

export interface RunSyncCommand {
  projectRoot: string;
  force: boolean;
  /** Whether a person can be asked. */
  interactive: boolean;
  tool?: string;
  plugin?: string;
  files: readonly string[];
}

/** What each step of the run found, handed over as it is known so the person reads it in order. */
export interface RunSyncReport {
  restored(result: RestoreAllResult): void;
  toolRestored(result: ToolRestoreResult): void;
  activated(activation: SyncSettingsResult): void;
}

/** Restores a project's files from its record, then re-drives native activation. A run that
 * errored synced nothing for that scope, so reporting success would name the unhealthy state
 * healthy: it throws, and the translator turns that into the non-zero exit. */
export class RunSync {
  constructor(
    private readonly restoreAll: Pick<RestoreAll, "execute">,
    private readonly restoreTool: Pick<RestoreTool, "execute">,
    private readonly syncSettings: Pick<SyncSettings, "execute">
  ) {}

  async execute(command: RunSyncCommand, report: RunSyncReport): Promise<void> {
    if (command.tool !== undefined) return this.executeTool(command, command.tool, report);
    const { projectRoot, force, interactive } = command;
    const result = await this.restoreAll.execute(projectRoot, force, !force && interactive);
    report.restored(result);

    // After restoration, never before: activation drives the host CLI that writes into the
    // settings file restoration regenerates, which must be on disk before that CLI runs.
    const activation = await this.syncSettings.execute({
      projectRoot,
      recreateFrameworkIfMissing: true,
    });
    report.activated(activation);
    if (result.failed || activation.failed) {
      throw new SyncFailedError([...result.errors, ...activation.errors]);
    }
  }

  private async executeTool(
    command: RunSyncCommand,
    toolId: string,
    report: RunSyncReport
  ): Promise<void> {
    const { projectRoot, files } = command;
    const result = await this.restoreTool.execute({
      projectRoot,
      toolId,
      files: files.length > 0 ? [...files] : undefined,
      force: command.force,
      interactive: command.interactive,
      pluginName: command.plugin,
    });
    report.toolRestored(result);

    // Same order as the full sync, narrowed to this one tool so fixing it re-drives no other
    // installed tool's activation.
    const activation = await this.syncSettings.execute({
      projectRoot,
      toolIds: result.tools.map((tool) => tool.toolId),
      recreateFrameworkIfMissing: true,
    });
    report.activated(activation);
    if (activation.failed) throw new SyncFailedError(activation.errors);
  }
}
