import { dirname, join, relative } from "node:path";
import { InstallationFile } from "../../domain/models/file.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

export interface InstallFrameworkPluginsOptions {
  frameworkPath: string;
  projectRoot: string;
  version: string;
  force?: boolean;
  cleanDeleted?: boolean;
}

export interface InstallFrameworkPluginsResult {
  installedCount: number;
  skippedCount: number;
  deletedCount: number;
  warnings: string[];
}

export class InstallFrameworkPluginsUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger
  ) {}

  async execute(options: InstallFrameworkPluginsOptions): Promise<InstallFrameworkPluginsResult> {
    const manifest = await this.manifestRepo.load();
    const absolutePaths = await this.collectFrameworkFiles(options.frameworkPath);
    const relativePathSet = this.buildRelativePathSet(absolutePaths, options.frameworkPath);
    const deletedCount = options.cleanDeleted
      ? await this.deleteRemovedFiles(manifest, relativePathSet, options.projectRoot)
      : 0;
    const result = await this.installFiles(absolutePaths, options, manifest);
    await this.persistPlugins(options.version, result.installed);
    return {
      installedCount: result.installed.length,
      skippedCount: result.skipped,
      deletedCount,
      warnings: result.warnings,
    };
  }

  private buildRelativePathSet(absolutePaths: string[], frameworkPath: string): Set<string> {
    return new Set(absolutePaths.map((p) => this.computeRelativePath(p, frameworkPath)));
  }

  private async deleteRemovedFiles(
    manifest: import("../../domain/models/manifest.js").Manifest | null,
    relativePathSet: Set<string>,
    projectRoot: string
  ): Promise<number> {
    const tracked = manifest?.getPluginsFiles() ?? [];
    const toDelete = tracked.filter((f) => !relativePathSet.has(f.relativePath));
    for (const f of toDelete) {
      await this.fs.deleteFile(join(projectRoot, f.relativePath));
    }
    return toDelete.length;
  }

  private async collectFrameworkFiles(frameworkPath: string): Promise<string[]> {
    const pluginsDir = join(frameworkPath, "plugins");
    const claudePluginDir = join(frameworkPath, ".claude-plugin");
    const [pluginFiles, catalogFiles] = await Promise.all([
      this.fs.listFilesRecursive(pluginsDir),
      this.fs.listFilesRecursive(claudePluginDir),
    ]);
    return [...pluginFiles, ...catalogFiles];
  }

  private computeRelativePath(absPath: string, frameworkPath: string): string {
    const frameworkPluginsBase = join(frameworkPath, "plugins");
    const frameworkCatalogBase = join(frameworkPath, ".claude-plugin");
    if (absPath.startsWith(frameworkPluginsBase)) {
      return join("plugins", relative(frameworkPluginsBase, absPath));
    }
    return join(".claude-plugin", relative(frameworkCatalogBase, absPath));
  }

  private async installSingleFile(
    absPath: string,
    options: InstallFrameworkPluginsOptions,
    isTracked: boolean
  ): Promise<InstallationFile | "skipped"> {
    const relativePath = this.computeRelativePath(absPath, options.frameworkPath);
    const destPath = join(options.projectRoot, relativePath);
    const exists = await this.fs.fileExists(destPath);
    if (exists && !isTracked && !options.force) {
      this.logger.warn(`Skipping untracked file: ${relativePath}`);
      return "skipped";
    }
    const content = await this.fs.readFile(absPath);
    await this.fs.createDirectory(dirname(destPath));
    await this.fs.writeFile(destPath, content);
    const hash = await this.fs.readFileHash(destPath);
    return new InstallationFile({ relativePath, content, hash, frameworkPath: absPath });
  }

  private async installFiles(
    absolutePaths: string[],
    options: InstallFrameworkPluginsOptions,
    manifest: import("../../domain/models/manifest.js").Manifest | null
  ): Promise<{ installed: InstallationFile[]; skipped: number; warnings: string[] }> {
    const installed: InstallationFile[] = [];
    const warnings: string[] = [];
    let skipped = 0;
    for (const absPath of absolutePaths) {
      const relativePath = this.computeRelativePath(absPath, options.frameworkPath);
      const tracked = manifest?.isFileTracked(relativePath) ?? false;
      const result = await this.installSingleFile(absPath, options, tracked);
      if (result === "skipped") {
        warnings.push(`Skipped (untracked): ${relativePath}`);
        skipped++;
      } else {
        installed.push(result);
      }
    }
    return { installed, skipped, warnings };
  }

  private async persistPlugins(version: string, files: InstallationFile[]): Promise<void> {
    if (files.length === 0) return;
    const manifest = await this.manifestRepo.load();
    if (!manifest) return;
    manifest.addPlugins(version, files);
    await this.manifestRepo.save(manifest);
  }
}
