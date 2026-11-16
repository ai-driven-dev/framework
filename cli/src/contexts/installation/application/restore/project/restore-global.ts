import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { ManifestRepository } from "../../../ports/manifest-repository.js";
import { requireManifest } from "../../shared/require-manifest.js";
import type { Restore } from "../restore.js";

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

/** A restore bound to the record `RestoreGlobal.open` read, so a run reads it once. */
export interface OpenRestore {
  /** The record that was read, for a caller that must ask something of it before restoring. */
  readonly manifest: Manifest;
  execute(command: RestoreGlobalCommand): Promise<RestoreGlobalResult>;
}

/** Restores a project from its own record, loaded here so nothing above holds the record. */
export class RestoreGlobal {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly restore: Pick<Restore, "execute">
  ) {}

  /** Reads the project's record, failing when it has none, and answers the restore it permits. */
  async open(): Promise<OpenRestore> {
    const manifest = await requireManifest(this.manifestRepo);
    return { manifest, execute: (command) => this.restoreFrom(manifest, command) };
  }

  private async restoreFrom(
    manifest: Manifest,
    command: RestoreGlobalCommand
  ): Promise<RestoreGlobalResult> {
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
