import type { VersionReader } from "../../../../../shared/ports/version-reader.js";
import type { ManifestRepository } from "../../../ports/manifest-repository.js";
import { requireManifest } from "../../shared/require-manifest.js";
import type { Restore } from "../restore.use-case.js";

export interface RestoreToolRequest {
  projectRoot: string;
  /** The AI tool to restore, as the caller named it; the restore refuses one no profile declares. */
  toolId: string;
  /** The files to restore; every drifted one of the tool when absent. */
  files?: string[];
  force: boolean;
  interactive: boolean;
  pluginName?: string;
}

/** Restores one tool of a project from its own record, loaded here so nothing above holds it. */
export class RestoreTool {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly restore: Pick<Restore, "execute">,
    private readonly currentVersion: VersionReader
  ) {}

  async execute(command: RestoreToolRequest): ReturnType<Restore["execute"]> {
    const manifest = await requireManifest(this.manifestRepo);
    return this.restore.execute({
      version: manifest.getToolVersion(command.toolId) ?? this.currentVersion.get(),
      projectRoot: command.projectRoot,
      toolIds: [command.toolId],
      files: command.files,
      force: command.force,
      interactive: command.interactive,
      manifest,
      pluginName: command.pluginName,
    });
  }
}
