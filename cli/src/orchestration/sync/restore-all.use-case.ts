import type { ReportStatus } from "../../contexts/installation/application/report-status.use-case.js";
import type {
  OpenRestore,
  RestoreGlobal,
} from "../../contexts/installation/application/restore/project/restore-global.use-case.js";
import { restorableDrift } from "../../contexts/installation/application/status/tool-file-drift.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { GlobalExecutionError } from "../global-execution.js";
import type { Prompter } from "../ports/prompter.js";

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

function nothingRestored(errors: GlobalExecutionError[], failed: boolean): RestoreAllResult {
  return {
    totalRestored: 0,
    totalKept: 0,
    pluginNamesRestored: [],
    errors,
    failed,
    unrestorable: [],
    nativeOnlyToolIds: [],
  };
}

export class RestoreAll {
  constructor(
    private readonly prompter: Prompter,
    private readonly reportStatus: Pick<ReportStatus, "execute">,
    private readonly restoreGlobal: Pick<RestoreGlobal, "execute">
  ) {}

  async execute(
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<RestoreAllResult> {
    const restore = await this.restoreGlobal.execute();
    const files = interactive
      ? await this.promptForFiles(projectRoot, restore.manifest)
      : undefined;
    if (files !== undefined && files.length === 0) return nothingRestored([], false);
    try {
      const result = await restore.execute({ projectRoot, files, force, interactive });
      return {
        totalRestored: result.totalRestored,
        totalKept: result.totalKept,
        pluginNamesRestored: result.restoredPluginNames,
        errors: [],
        failed: false,
        unrestorable: result.unrestorable,
        nativeOnlyToolIds: result.nativeOnlyToolIds,
      };
    } catch (err) {
      return nothingRestored([{ scope: "config-restore", error: err }], true);
    }
  }

  private async promptForFiles(
    projectRoot: string,
    manifest: OpenRestore["manifest"]
  ): Promise<string[] | undefined> {
    const report = await this.reportStatus.execute({ projectRoot, manifest });
    const driftedFiles = report.tools.flatMap((t) => restorableDrift(t.drifted));
    if (driftedFiles.length === 0) return undefined;
    return this.prompter.checkbox(
      "Select files to restore:",
      driftedFiles.map((f) => ({ name: f, value: f }))
    );
  }
}
