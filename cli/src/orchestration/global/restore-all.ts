import type { ReportStatus } from "../../contexts/installation/application/report-status.js";
import type {
  OpenRestore,
  RestoreGlobal,
} from "../../contexts/installation/application/restore/project/restore-global.js";
import type { GlobalExecutionError } from "../../shared/domain/errors/global-execution-error.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { Prompter } from "../../shared/ports/prompter.js";

export interface RestoreAllResult {
  totalRestored: number;
  totalKept: number;
  pluginNamesRestored: string[];
  errors: GlobalExecutionError[];
  /** The verdict on `errors`: one error fails the run. */
  failed: boolean;
  unrestorable: string[];
  /** AI tools this run could not restore any plugin file for because their
   * registration is native: the tool's own CLI owns it, not a file tree. */
  nativeOnlyToolIds: AiToolId[];
}

export class RestoreAll {
  constructor(
    private readonly prompter: Prompter,
    private readonly reportStatus: Pick<ReportStatus, "execute">,
    private readonly restoreGlobal: Pick<RestoreGlobal, "open">
  ) {}

  async execute(
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<RestoreAllResult> {
    const errors: GlobalExecutionError[] = [];
    const restore = await this.restoreGlobal.open();

    const files = interactive
      ? await this.promptForFiles(projectRoot, restore.manifest)
      : undefined;
    if (files !== undefined && files.length === 0) {
      return {
        totalRestored: 0,
        totalKept: 0,
        pluginNamesRestored: [],
        errors,
        failed: false,
        unrestorable: [],
        nativeOnlyToolIds: [],
      };
    }
    try {
      const result = await restore.execute({
        projectRoot,
        files,
        force,
        interactive,
      });
      return {
        totalRestored: result.totalRestored,
        totalKept: result.totalKept,
        pluginNamesRestored: result.restoredPluginNames,
        errors,
        failed: false,
        unrestorable: result.unrestorable,
        nativeOnlyToolIds: result.nativeOnlyToolIds,
      };
    } catch (err) {
      errors.push({
        scope: "config-restore",
        message: err instanceof Error ? err.message : String(err),
      });
      return {
        totalRestored: 0,
        totalKept: 0,
        pluginNamesRestored: [],
        errors,
        failed: true,
        unrestorable: [],
        nativeOnlyToolIds: [],
      };
    }
  }

  private async promptForFiles(
    projectRoot: string,
    manifest: OpenRestore["manifest"]
  ): Promise<string[] | undefined> {
    const report = await this.reportStatus.execute({ projectRoot, manifest });
    const driftedFiles = report.tools.flatMap((t) =>
      t.drifted
        .filter((d) => d.status === "modified" || d.status === "deleted")
        .map((d) => d.relativePath)
    );
    if (driftedFiles.length === 0) return undefined;
    return this.prompter.checkbox(
      "Select files to restore:",
      driftedFiles.map((f) => ({ name: f, value: f }))
    );
  }
}
