import { join } from "node:path";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { DoctorIssue } from "../../contract/doctor-issue.js";
import type { Manifest } from "../../domain/manifest.js";
import type { CheckInstallationCommand } from "./check-installation-command.js";
import type { LoadManifest } from "./load-manifest.js";

export function collectTrackedFiles(
  manifest: Manifest,
  allowedIds: Set<string> | null
): { relativePath: string; toolId: ToolId | null }[] {
  const result: { relativePath: string; toolId: ToolId | null }[] = [];
  for (const toolId of manifest.getInstalledToolIds()) {
    if (allowedIds && !allowedIds.has(toolId)) continue;
    const files = manifest.getToolFiles(toolId);
    result.push(...files.map((f) => ({ ...f, toolId })));
  }
  return result;
}

export class CheckTrackedFiles {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly fs: FileReader
  ) {}

  async execute(command: CheckInstallationCommand): Promise<DoctorIssue[]> {
    const { projectRoot, allowedIds } = command;
    const manifest = await this.loadManifest.execute();
    const trackedFiles = collectTrackedFiles(manifest, allowedIds);
    const missingIssues = await this.checkMissingFiles(trackedFiles, projectRoot);
    const modifiedIssues = await this.checkModifiedFiles(manifest, projectRoot, allowedIds);
    return [...missingIssues, ...modifiedIssues];
  }

  private async checkMissingFiles(
    files: ReadonlyArray<{ relativePath: string; toolId: ToolId | null }>,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        issues.push({
          severity: "error",
          message: `Missing tracked file: ${file.relativePath}`,
          fix: `Restore the file or run \`aidd sync\` to reinstall tracked files.`,
        });
      }
    }
    return issues;
  }

  private async checkModifiedFiles(
    manifest: Manifest,
    projectRoot: string,
    allowedIds: Set<string> | null
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
      for (const file of manifest.getToolFiles(toolId)) {
        const fullPath = join(projectRoot, file.relativePath);
        if (!(await this.fs.fileExists(fullPath))) continue;
        const diskHash = await this.fs.readFileHash(fullPath);
        if (!diskHash.equals(file.hash)) {
          issues.push({
            severity: "warning",
            message: `Modified tracked file: ${file.relativePath}`,
            fix: `Run \`aidd sync --force\` to revert to the framework version.`,
          });
        }
      }
    }
    return issues;
  }
}
