import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { TokenProvider } from "../../../auth/contract/token-provider.js";
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
    private readonly fs: FileReader,
    private readonly authReader?: TokenProvider
  ) {}

  async execute(command: CheckProjectLayoutCommand): Promise<DoctorIssue[]> {
    const { projectRoot, tools } = command;
    const manifest = await this.loadManifest.execute();
    const orphanIssues = await this.checkOrphanedDirectories(manifest, projectRoot, tools);
    const authIssues = await this.checkAuth();
    return [...orphanIssues, ...authIssues];
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

  private async checkAuth(): Promise<DoctorIssue[]> {
    if (!this.authReader) return [];
    const token = await this.authReader.resolve();
    if (token === null) {
      return [
        {
          severity: "info",
          message: "Not authenticated",
          fix: "Run aidd auth login",
        },
      ];
    }
    return [];
  }
}
