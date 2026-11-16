import type { ReportStatus } from "../../contexts/installation/application/report-status.js";
import type {
  OpenRestore,
  RestoreGlobal,
} from "../../contexts/installation/application/restore/project/restore-global.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { GlobalExecutionError } from "../../shared/domain/errors.js";
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
   * registration is native — the tool's own CLI owns it, not a file tree. */
  nativeOnlyToolIds: AiToolId[];
}

export class RestoreAll {
  constructor(
    private readonly prompter: Prompter,
    private readonly reportStatus: ReportStatus,
    private readonly restoreGlobal: RestoreGlobal
  ) {}

  async execute(
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    tools: ToolCatalog
  ): Promise<RestoreAllResult> {
    const errors: GlobalExecutionError[] = [];
    const restore = await this.restoreGlobal.open();

    const files = interactive
      ? await this.promptForFiles(projectRoot, tools, restore.manifest)
      : undefined;
    if (files !== undefined && files.length === 0) {
      return {
        totalRestored: 0,
        totalKept: 0,
        pluginNamesRestored: [],
        errors,
        failed: errors.length > 0,
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
        tools,
      });
      return {
        totalRestored: result.totalRestored,
        totalKept: result.totalKept,
        pluginNamesRestored: result.restoredPluginNames,
        errors,
        failed: errors.length > 0,
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
        failed: errors.length > 0,
        unrestorable: [],
        nativeOnlyToolIds: [],
      };
    }
  }

  private async promptForFiles(
    projectRoot: string,
    tools: ToolCatalog,
    manifest: OpenRestore["manifest"]
  ): Promise<string[] | undefined> {
    const report = await this.reportStatus.execute({ projectRoot, tools, manifest });
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
