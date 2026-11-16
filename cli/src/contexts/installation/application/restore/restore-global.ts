import { NoManifestError } from "../../../../shared/domain/errors.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { Restore } from "./restore.js";

export interface RestoreGlobalCommand {
  projectRoot: string;
  /** The files to restore; every drifted one when absent. */
  files?: string[];
  force: boolean;
  interactive: boolean;
  tools: ToolCatalog;
}

export interface RestoreGlobalResult {
  totalRestored: number;
  totalKept: number;
  restoredPluginNames: string[];
  unrestorable: string[];
  /** AI tools this run could not restore any plugin file for because their
   * registration is native — the tool's own CLI owns it, not a file tree. */
  nativeOnlyToolIds: AiToolId[];
}

/** Restores a project from its own record, loaded here so nothing above holds the record. */
export class RestoreGlobal {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly restore: Pick<Restore, "execute">
  ) {}

  /** Throws NoManifestError when the project has no record. */
  async assertInstalled(): Promise<void> {
    if ((await this.manifestRepo.load()) === null) throw new NoManifestError();
  }

  async execute(command: RestoreGlobalCommand): Promise<RestoreGlobalResult> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();
    const version =
      manifest
        .getInstalledToolIds()
        .map((id) => manifest.getToolVersion(id))
        .find((v) => v !== undefined) ?? "unknown";
    const result = await this.restore.execute({
      version,
      projectRoot: command.projectRoot,
      files: command.files,
      // Consent to overwrite a modified file comes from either the checkbox the interactive run
      // already made the user answer, or `--force` when there is no TTY to ask. Neither is a reason
      // to ask a second time.
      force: command.force || command.interactive,
      interactive: command.interactive,
      manifest,
      tools: command.tools,
    });
    return {
      totalRestored: result.totalRestored,
      totalKept: result.totalKept,
      restoredPluginNames: result.restoredPluginNames,
      unrestorable: result.unrestorable,
      nativeOnlyToolIds: result.nativeOnlyToolIds,
    };
  }
}
