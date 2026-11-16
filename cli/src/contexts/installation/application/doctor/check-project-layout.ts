import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { DoctorIssue } from "../../contract/doctor-issue.js";
import type { Manifest } from "../../domain/manifest.js";
import { detectToolSignals } from "../init-project.js";
import type { LoadManifest } from "./load-manifest.js";

export interface CheckProjectLayoutCommand {
  projectRoot: string;
  tools: ToolCatalog;
}

export class CheckProjectLayout {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly fs: FileReader
  ) {}

  async execute(command: CheckProjectLayoutCommand): Promise<DoctorIssue[]> {
    const { projectRoot, tools } = command;
    const manifest = await this.loadManifest.execute();
    return this.checkOrphanedDirectories(manifest, projectRoot, tools);
  }

  private async checkOrphanedDirectories(
    manifest: Manifest,
    projectRoot: string,
    tools: ToolCatalog
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    const installedToolDirs = manifest.getInstalledDirectories();
    for (const tool of tools.sortedById()) {
      if ((await detectToolSignals(this.fs, tool, projectRoot)).length > 0) {
        if (!installedToolDirs.has(tool.directory)) {
          issues.push({
            severity: "warning",
            message: `Orphaned directory: ${tool.directory} (not tracked in manifest)`,
            fix: "Remove the directory manually, or run `aidd install <tool>` to track it.",
          });
        }
      }
    }
    return issues;
  }
}
