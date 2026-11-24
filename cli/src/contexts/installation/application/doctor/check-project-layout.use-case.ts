import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { DoctorIssue } from "../../contract/doctor-issue.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { detectToolSignals } from "../init-project.use-case.js";
import { requireManifest } from "../shared/require-manifest.js";

export interface CheckProjectLayoutRequest {
  projectRoot: string;
}

export class CheckProjectLayout {
  constructor(
    private readonly manifestRepo: Pick<ManifestRepository, "load">,
    private readonly fs: FileReader,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: CheckProjectLayoutRequest): Promise<DoctorIssue[]> {
    const { projectRoot } = command;
    const manifest = await requireManifest(this.manifestRepo);
    return this.checkOrphanedDirectories(manifest, projectRoot);
  }

  private async checkOrphanedDirectories(
    manifest: Manifest,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    const installedToolDirs = manifest.getInstalledDirectories();
    for (const id of this.tools.sortedIds()) {
      const tool = this.tools.profile(id);
      if ((await detectToolSignals(this.fs, tool, projectRoot)).length > 0) {
        if (!installedToolDirs.has(tool.directory)) {
          issues.push({
            severity: "warning",
            message: `Orphaned directory: ${tool.directory} (not tracked in manifest)`,
            fix: { code: "remove-or-track-directory" },
          });
        }
      }
    }
    return issues;
  }
}
