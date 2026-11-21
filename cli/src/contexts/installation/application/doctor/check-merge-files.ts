import { join } from "node:path";
import { extractMergeEntries, type MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { DoctorIssue } from "../../contract/doctor-issue.js";
import { driftOf } from "../../domain/manifest/drift.js";
import type { CheckInstallationCommand } from "./check-installation-command.js";
import type { LoadManifest } from "./load-manifest.js";

export class CheckMergeFiles {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly fs: FileReader
  ) {}

  async execute(command: CheckInstallationCommand): Promise<DoctorIssue[]> {
    const { projectRoot, allowedIds } = command;
    const manifest = await this.loadManifest.execute();
    const issues: DoctorIssue[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
      for (const mergeFile of manifest.getMergeFiles(toolId)) {
        issues.push(...(await this.checkOneMergeFile(mergeFile, projectRoot)));
      }
    }
    return issues;
  }

  private async checkOneMergeFile(
    mergeFile: MergeFileEntry,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const fullPath = join(projectRoot, mergeFile.relativePath);
    if (!(await this.fs.fileExists(fullPath))) {
      return [
        {
          severity: "error",
          message: `Missing merge file: ${mergeFile.relativePath}`,
          fix: { code: "sync-force", effect: "reinstall-files" },
        },
      ];
    }
    return this.compareKeys(mergeFile, fullPath);
  }

  private async compareKeys(mergeFile: MergeFileEntry, fullPath: string): Promise<DoctorIssue[]> {
    const content = await this.fs.readFile(fullPath);
    const diskEntries = extractMergeEntries(content, mergeFile.sectionKey);
    const issues: DoctorIssue[] = [];
    for (const [key, manifestHash] of Object.entries(mergeFile.entries)) {
      const verdict = driftOf(manifestHash.value, diskEntries[key] ?? null);
      if (verdict === "missing") {
        issues.push({
          severity: "error",
          message: `Missing key in ${mergeFile.relativePath} > ${key}`,
          fix: { code: "sync-force", effect: "restore-keys" },
        });
      } else if (verdict === "modified") {
        issues.push({
          severity: "warning",
          message: `Modified key in ${mergeFile.relativePath} > ${key}`,
          fix: { code: "sync-force", effect: "restore-value" },
        });
      }
    }
    return issues;
  }
}
