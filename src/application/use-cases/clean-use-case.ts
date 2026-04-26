import { dirname, join } from "node:path";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../domain/models/merge.js";
import { AIDD_DIR } from "../../domain/models/paths.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import type { ToolId } from "../../domain/tools/registry.js";
import { GitignoreUseCase } from "./shared/gitignore-use-case.js";

interface CleanOptions {
  projectRoot: string;
  force: boolean;
  interactive?: boolean;
}

interface CleanPreview {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  docsFileCount: number;
  totalFileCount: number;
}

interface CleanResult {
  dryRun: boolean;
  preview: CleanPreview;
  fileCount: number;
}

export class CleanUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly prompter?: Prompter
  ) {}

  async execute(options: CleanOptions): Promise<CleanResult> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      return {
        dryRun: false,
        preview: { tools: [], docsFileCount: 0, totalFileCount: 0 },
        fileCount: 0,
      };
    }

    const tools = manifest.getInstalledToolIds().map((toolId) => ({
      toolId,
      fileCount: manifest.getToolFiles(toolId).length + manifest.getMergeFiles(toolId).length,
    }));
    const docsFileCount = manifest.getDocsFiles().length;
    const totalFileCount = tools.reduce((s, t) => s + t.fileCount, 0) + docsFileCount;

    const preview: CleanPreview = { tools, docsFileCount, totalFileCount };

    if (!options.force) {
      if (options.interactive && this.prompter) {
        const confirmed = await this.prompter.confirm("Remove all AIDD files?");
        if (!confirmed) return { dryRun: true, preview, fileCount: 0 };
      } else {
        return { dryRun: true, preview, fileCount: 0 };
      }
    }

    let deleted = 0;

    for (const toolId of manifest.getInstalledToolIds()) {
      this.logger.info(`Removing ${toolId} files...`);
      deleted += await this.deleteFiles(manifest.getToolFiles(toolId), options.projectRoot);
      deleted += await this.cleanMergeFileKeys(manifest.getMergeFiles(toolId), options.projectRoot);
    }

    this.logger.info("Removing docs files...");
    deleted += await this.deleteFiles(manifest.getDocsFiles(), options.projectRoot);

    const catalogPath = join(options.projectRoot, manifest.docsDir, "CATALOG.md");
    await this.fs.deleteFile(catalogPath);
    await this.fs.deleteEmptyDirectories(join(options.projectRoot, manifest.docsDir));

    await this.fs.deleteDirectory(join(options.projectRoot, AIDD_DIR));
    await new GitignoreUseCase(this.fs).remove(options.projectRoot, [`${AIDD_DIR}/cache/`]);

    return { dryRun: false, preview, fileCount: deleted };
  }

  private async cleanMergeFileKeys(
    mergeFiles: readonly MergeFileEntry[],
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const mergeFile of mergeFiles) {
      const fullPath = join(projectRoot, mergeFile.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      const keys = Object.keys(mergeFile.entries);
      if (keys.length === 0) {
        await this.fs.deleteFile(fullPath);
        await this.fs.deleteEmptyDirectories(dirname(fullPath));
        count++;
        continue;
      }
      const content = await this.fs.readFile(fullPath);
      const cleaned = removeEntriesFromJson(content, mergeFile.sectionKey, keys);
      if (isMergeContentEmpty(cleaned, mergeFile.sectionKey)) {
        await this.fs.deleteFile(fullPath);
        await this.fs.deleteEmptyDirectories(dirname(fullPath));
      } else {
        await this.fs.writeFile(fullPath, cleaned);
      }
      count++;
    }
    return count;
  }

  private async deleteFiles(
    files: ReadonlyArray<{ relativePath: string }>,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      count++;
    }
    return count;
  }
}
