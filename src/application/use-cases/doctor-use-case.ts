import { dirname, join, normalize } from "node:path";
import { ManifestValidationError } from "../../domain/errors.js";
import {
  extractAtReferences,
  extractMarkdownLinkTargets,
  isFileReference,
} from "../../domain/formats/markdown-references.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { extractMergeEntries, type MergeFileEntry } from "../../domain/models/merge.js";
import type { AiToolId } from "../../domain/models/tool-ids.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { TokenProvider } from "../../domain/ports/token-provider.js";
import {
  getAllRegisteredTools,
  hasToolSignals,
  type ToolCategory,
  type ToolId,
  toolIdsForCategory,
} from "../../domain/tools/registry.js";
import { NoManifestError } from "../errors.js";

export {
  extractAtReferences,
  extractMarkdownLinkTargets,
} from "../../domain/formats/markdown-references.js";

type IssueSeverity = "info" | "warning" | "error";

interface DoctorIssue {
  severity: IssueSeverity;
  message: string;
  fix: string;
}

interface ToolHealth {
  toolId: ToolId;
  fileCount: number;
  mergeFileCount: number;
}

type PluginIssueKind = "missing" | "hash-mismatch";

interface PluginIssueEntry {
  toolId: AiToolId;
  pluginName: string;
  issue: PluginIssueKind;
  filePath: string;
}

interface DoctorReport {
  healthy: boolean;
  toolHealth: ToolHealth[];
  issues: DoctorIssue[];
  pluginIssues: PluginIssueEntry[];
}

interface DoctorOptions {
  projectRoot: string;
  category?: ToolCategory;
  repo?: string;
  pluginName?: string;
}

export class DoctorUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    readonly _logger: Logger,
    private readonly authReader?: TokenProvider
  ) {}

  async execute(options: DoctorOptions): Promise<DoctorReport> {
    const { projectRoot, category, repo, pluginName } = options;

    let manifest: Manifest | null;
    try {
      manifest = await this.manifestRepo.load();
    } catch {
      throw new ManifestValidationError(
        "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize."
      );
    }

    if (manifest === null) {
      throw new NoManifestError(repo);
    }

    const allowedIds = category ? new Set(toolIdsForCategory(category) as readonly string[]) : null;

    const issues: DoctorIssue[] = [];
    const toolHealth: ToolHealth[] = [];
    const allTrackedFiles: { relativePath: string; toolId: ToolId | null }[] = [];

    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
      const files = manifest.getToolFiles(toolId);
      const mergeFiles = manifest.getMergeFiles(toolId);
      toolHealth.push({ toolId, fileCount: files.length, mergeFileCount: mergeFiles.length });
      allTrackedFiles.push(...files.map((f) => ({ ...f, toolId })));
    }

    if (!category) issues.push(...(await this.checkDocsDirectory(manifest, projectRoot)));
    issues.push(...(await this.checkMissingTrackedFiles(allTrackedFiles, projectRoot)));
    issues.push(...(await this.checkModifiedTrackedFiles(manifest, projectRoot, allowedIds)));
    issues.push(...(await this.checkMergeFileKeys(manifest, projectRoot, allowedIds)));
    issues.push(...(await this.checkBrokenReferences(allTrackedFiles, projectRoot)));
    if (!category) issues.push(...(await this.checkOrphanedDirectories(manifest, projectRoot)));
    if (!category) issues.push(...(await this.checkAuth()));

    const pluginIssues = await this.checkAllPlugins(manifest, projectRoot, allowedIds, pluginName);

    return {
      healthy:
        issues.filter((i) => i.severity !== "info").length === 0 && pluginIssues.length === 0,
      toolHealth,
      issues,
      pluginIssues,
    };
  }

  private async checkDocsDirectory(
    manifest: Manifest,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    const manifestDocsDir = manifest.docsDir;
    const docsDirPath = join(projectRoot, manifestDocsDir);

    if (!(await this.fs.fileExists(docsDirPath))) {
      issues.push({
        severity: "error",
        message: `Docs directory '${manifestDocsDir}' does not exist on disk`,
        fix: "Run `aidd init --force` to recreate the docs directory.",
      });
    }

    return issues;
  }

  private async checkMissingTrackedFiles(
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
          fix: `Restore the file or run \`aidd restore\` to reinstall tracked files.`,
        });
      }
    }
    return issues;
  }

  private async checkModifiedTrackedFiles(
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
            fix: `Run \`aidd restore --force\` to revert to the framework version.`,
          });
        }
      }
    }
    return issues;
  }

  private async checkOrphanedDirectories(
    manifest: Manifest,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    const installedToolDirs = manifest.getInstalledDirectories();

    for (const tool of getAllRegisteredTools().values()) {
      if ((await hasToolSignals(this.fs, tool, projectRoot)).length > 0) {
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

  private async checkMergeFileKeys(
    manifest: Manifest,
    projectRoot: string,
    allowedIds: Set<string> | null = null
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
      for (const mergeFile of manifest.getMergeFiles(toolId)) {
        issues.push(...(await this.checkOneMergeFileHealth(mergeFile, projectRoot)));
      }
    }
    return issues;
  }

  private async checkOneMergeFileHealth(
    mergeFile: MergeFileEntry,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const fullPath = join(projectRoot, mergeFile.relativePath);
    if (!(await this.fs.fileExists(fullPath))) {
      return [
        {
          severity: "error",
          message: `Missing merge file: ${mergeFile.relativePath}`,
          fix: `Run \`aidd restore --force\` to reinstall tracked files.`,
        },
      ];
    }
    return this.compareMergeFileKeys(mergeFile, fullPath);
  }

  private async compareMergeFileKeys(
    mergeFile: MergeFileEntry,
    fullPath: string
  ): Promise<DoctorIssue[]> {
    const content = await this.fs.readFile(fullPath);
    const diskEntries = extractMergeEntries(content, mergeFile.sectionKey, this.hasher);
    const issues: DoctorIssue[] = [];
    for (const [key, manifestHash] of Object.entries(mergeFile.entries)) {
      const diskHash = diskEntries[key];
      if (!diskHash) {
        issues.push({
          severity: "error",
          message: `Missing key in ${mergeFile.relativePath} > ${key}`,
          fix: `Run \`aidd restore --force\` to restore managed keys.`,
        });
      } else if (!diskHash.equals(manifestHash)) {
        issues.push({
          severity: "warning",
          message: `Modified key in ${mergeFile.relativePath} > ${key}`,
          fix: `Run \`aidd restore --force\` to restore the original value.`,
        });
      }
    }
    return issues;
  }

  private async checkAllPlugins(
    manifest: Manifest,
    projectRoot: string,
    allowedIds: Set<string> | null,
    pluginName?: string
  ): Promise<PluginIssueEntry[]> {
    const result: PluginIssueEntry[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
      const entries = await this.checkPluginsForTool(
        toolId as AiToolId,
        manifest,
        projectRoot,
        pluginName
      );
      result.push(...entries);
    }
    return result;
  }

  private async checkPluginsForTool(
    toolId: AiToolId,
    manifest: Manifest,
    projectRoot: string,
    pluginName?: string
  ): Promise<PluginIssueEntry[]> {
    const plugins = manifest.getPlugins(toolId);
    const targets = pluginName ? plugins.filter((p) => p.name === pluginName) : plugins;
    const result: PluginIssueEntry[] = [];
    for (const plugin of targets) {
      const issues = await this.checkOnePlugin(toolId, plugin.name, plugin.files, projectRoot);
      result.push(...issues);
    }
    return result;
  }

  private async checkOnePlugin(
    toolId: AiToolId,
    pluginName: string,
    files: ReadonlyMap<string, string>,
    projectRoot: string
  ): Promise<PluginIssueEntry[]> {
    const issues: PluginIssueEntry[] = [];
    for (const [relativePath, expectedHash] of files.entries()) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        issues.push({ toolId, pluginName, issue: "missing", filePath: relativePath });
      } else {
        const diskHash = await this.fs.readFileHash(fullPath);
        if (diskHash.value !== expectedHash) {
          issues.push({ toolId, pluginName, issue: "hash-mismatch", filePath: relativePath });
        }
      }
    }
    return issues;
  }

  private async checkBrokenReferences(
    files: ReadonlyArray<{ relativePath: string; toolId: ToolId | null }>,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];

    for (const file of files) {
      if (!file.relativePath.match(/\.(md|mdc)$/)) continue;
      if (file.relativePath.includes("/tasks/")) continue;

      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;

      const content = await this.fs.readFile(fullPath);
      const atRefs = extractAtReferences(content)
        .filter(isFileReference)
        .map((ref) => ({
          ref,
          resolvedPath: join(projectRoot, ref),
        }));
      const linkRefs = extractMarkdownLinkTargets(content)
        .filter(isFileReference)
        .map((ref) => ({
          ref,
          resolvedPath: normalize(join(projectRoot, dirname(file.relativePath), ref)),
        }));

      for (const { ref, resolvedPath } of [...atRefs, ...linkRefs]) {
        // Skip refs that resolve outside projectRoot (dev workspace paths like @../framework/...).
        const normalizedResolved = normalize(resolvedPath);
        const normalizedRoot = normalize(projectRoot);
        if (!normalizedResolved.startsWith(normalizedRoot)) continue;
        if (!(await this.fs.fileExists(resolvedPath))) {
          issues.push({
            severity: "warning",
            message: `Broken reference in ${file.relativePath}: "${ref}" not found on disk`,
            fix: `Restore the missing file or remove the reference in ${file.relativePath}`,
          });
        }
      }
    }

    return issues;
  }
}
