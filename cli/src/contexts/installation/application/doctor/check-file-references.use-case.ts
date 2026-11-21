import { dirname, join, normalize } from "node:path";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { DoctorIssue } from "../../contract/doctor-issue.js";
import type { Manifest } from "../../domain/manifest.js";
import {
  extractAtReferences,
  extractMarkdownLinkTargets,
  isFileReference,
} from "../../domain/markdown-references.js";
import type { CheckInstallationRequest } from "./check-installation-request.js";
import { collectTrackedFiles } from "./check-tracked-files.use-case.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

export class CheckFileReferences {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly fs: FileReader
  ) {}

  async execute(command: CheckInstallationRequest): Promise<DoctorIssue[]> {
    const { projectRoot, allowedIds } = command;
    const manifest = await this.loadManifest.execute();
    const trackedFiles = collectTrackedFiles(manifest, allowedIds);
    const scanFiles = this.gatherAllMarkdownFiles(manifest, trackedFiles, allowedIds);
    return this.checkBrokenReferences(scanFiles, projectRoot);
  }

  private gatherAllMarkdownFiles(
    manifest: Manifest,
    trackedFiles: { relativePath: string; toolId: ToolId | null }[],
    allowedIds: Set<string> | null
  ): { relativePath: string; toolId: ToolId | null }[] {
    const pluginFiles = manifest
      .getInstalledToolIds()
      .filter((toolId) => allowedIds === null || allowedIds.has(toolId))
      .flatMap((toolId) =>
        manifest
          .getPlugins(toolId)
          .flatMap((plugin) =>
            [...plugin.files.keys()].map((relativePath) => ({ relativePath, toolId }))
          )
      );
    return [...trackedFiles, ...pluginFiles];
  }

  private async checkBrokenReferences(
    files: ReadonlyArray<{ relativePath: string; toolId: ToolId | null }>,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    for (const file of files) {
      if (!file.relativePath.match(/\.(md|mdc)$/)) continue;
      if (file.relativePath.includes("/tasks/")) continue;
      const fileIssues = await this.checkFileReferences(file.relativePath, projectRoot);
      issues.push(...fileIssues);
    }
    return issues;
  }

  private async checkFileReferences(
    relativePath: string,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const fullPath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(fullPath))) return [];
    const content = await this.fs.readFile(fullPath);
    const refs = this.extractAllRefs(content, relativePath, projectRoot);
    const issues: DoctorIssue[] = [];
    for (const { ref, resolvedPath } of refs) {
      if (!this.isWithinProjectRoot(resolvedPath, projectRoot)) continue;
      if (!(await this.fs.fileExists(resolvedPath))) {
        issues.push({
          severity: "warning",
          message: `Broken reference in ${relativePath}: "${ref}" not found on disk`,
          fix: `Restore the missing file or remove the reference in ${relativePath}`,
        });
      }
    }
    return issues;
  }

  private extractAllRefs(
    content: string,
    relativePath: string,
    projectRoot: string
  ): { ref: string; resolvedPath: string }[] {
    const atRefs = extractAtReferences(content)
      .filter(isFileReference)
      .map((ref) => ({ ref, resolvedPath: join(projectRoot, ref) }));
    const linkRefs = extractMarkdownLinkTargets(content)
      .filter(isFileReference)
      .map((ref) => ({
        ref,
        resolvedPath: normalize(join(projectRoot, dirname(relativePath), ref)),
      }));
    return [...atRefs, ...linkRefs];
  }

  private isWithinProjectRoot(resolvedPath: string, projectRoot: string): boolean {
    return normalize(resolvedPath).startsWith(normalize(projectRoot));
  }
}
