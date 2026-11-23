import { join } from "node:path";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { DoctorIssue } from "../../contract/doctor-issue.js";
import { driftOf } from "../../domain/drift.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstallationScope } from "./installation-scope.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

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

export type CheckTrackedFilesRequest = InstallationScope;

export class CheckTrackedFiles {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly fs: FileReader
  ) {}

  async execute(command: CheckTrackedFilesRequest): Promise<DoctorIssue[]> {
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
          fix: { code: "restore-or-sync" },
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
    const files = manifest
      .getInstalledToolIds()
      .filter((toolId) => allowedIds === null || allowedIds.has(toolId))
      .flatMap((toolId) => manifest.getToolFiles(toolId));
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      if (driftOf(file.hash.value, await this.fs.readFileHash(fullPath)) !== "modified") continue;
      issues.push({
        severity: "warning",
        message: `Modified tracked file: ${file.relativePath}`,
        fix: { code: "sync-force", effect: "revert-file" },
      });
    }
    return issues;
  }
}
