import { join } from "node:path";
import { FileHash } from "../../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import {
  extractMergeEntries,
  type MergeFileEntry,
  type MergeStrategy,
} from "../../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { FileMerger } from "../../../ports/file-merger.js";

/** Decides, for one file about to be written, whether the write goes ahead. */
export type BeforeWriteGate = (relativePath: string) => Promise<"write" | "skip">;

/** Writes and merges the config files of a tool while keeping what the manifest must record
 * about each: the hash of a written file, the hash of what a skipped file holds on disk, and the
 * entries a merged file contributes. */
export class TrackedConfigFiles {
  constructor(
    private readonly fs: FileReader & FileWriter & FileMerger,
    private readonly logger: Logger
  ) {}

  /** A file whose hash is that of `content`. */
  fileOf(relativePath: string, content: string, mergeStrategy?: MergeStrategy): InstallationFile {
    return new InstallationFile({
      relativePath,
      content,
      hash: FileHash.of(content),
      mergeStrategy,
    });
  }

  /** Whether the file exists in the project without the manifest tracking it, which marks it as
   * the user's: it is left alone and a warning says so. */
  async isUserOwned(
    relativePath: string,
    projectRoot: string,
    manifest: Manifest
  ): Promise<boolean> {
    if (!(await this.fs.fileExists(join(projectRoot, relativePath)))) return false;
    if (manifest.isFileTracked(relativePath)) return false;
    this.logger.warn(`Skipping ${relativePath} — exists but not tracked by aidd`);
    return true;
  }

  /** Writes each file the gate lets through. A file the gate skips stays as it is on disk and is
   * tracked by the hash it holds there. */
  async writeAndTrack(
    files: InstallationFile[],
    projectRoot: string,
    onBeforeWrite?: BeforeWriteGate
  ): Promise<InstallationFile[]> {
    const tracked: InstallationFile[] = [];
    for (const file of files) {
      const decision = onBeforeWrite ? await onBeforeWrite(file.relativePath) : "write";
      if (decision === "skip") {
        tracked.push(await this.skippedFileOnDisk(file, projectRoot));
        continue;
      }
      await this.fs.writeFile(join(projectRoot, file.relativePath), file.content);
      tracked.push(file);
    }
    return tracked;
  }

  /** Merges each file into the one on disk and answers what the merged file now holds. */
  async mergeAndTrack(files: InstallationFile[], projectRoot: string): Promise<MergeFileEntry[]> {
    for (const file of files) {
      await this.fs.mergeJsonFile(
        join(projectRoot, file.relativePath),
        file.content,
        file.mergeStrategy
      );
    }
    return this.mergeEntriesOnDisk(files, projectRoot);
  }

  private async skippedFileOnDisk(
    file: InstallationFile,
    projectRoot: string
  ): Promise<InstallationFile> {
    const diskHash = await this.fs.readFileHash(join(projectRoot, file.relativePath));
    return new InstallationFile({ relativePath: file.relativePath, content: "", hash: diskHash });
  }

  private async mergeEntriesOnDisk(
    files: InstallationFile[],
    projectRoot: string
  ): Promise<MergeFileEntry[]> {
    const entries: MergeFileEntry[] = [];
    for (const file of files) {
      const diskContent = await this.fs.readFile(join(projectRoot, file.relativePath));
      const hashes = extractMergeEntries(diskContent, null);
      entries.push({ relativePath: file.relativePath, sectionKey: null, entries: hashes });
    }
    return entries;
  }
}
