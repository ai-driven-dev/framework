import { join } from "node:path";
import { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import { extractMergeEntries, type MergeFileEntry } from "../../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { FileMerger } from "../../../ports/file-merger.js";

/** Decides, for one file about to be written, whether the write goes ahead. */
export type BeforeWriteGate = (relativePath: string) => Promise<"write" | "skip">;

export interface TrackedConfigFilesRequest {
  kind: "is-user-owned";
  relativePath: string;
  projectRoot: string;
  manifest: Manifest;
}

export interface WriteAndTrackCommand {
  kind: "write-and-track";
  files: InstallationFile[];
  projectRoot: string;
  onBeforeWrite?: BeforeWriteGate;
}

export interface MergeAndTrackCommand {
  kind: "merge-and-track";
  files: InstallationFile[];
  projectRoot: string;
}

export type TrackedConfigFilesCommand =
  | TrackedConfigFilesRequest
  | WriteAndTrackCommand
  | MergeAndTrackCommand;

/** Writes and merges the config files of a tool while keeping what the manifest must record
 * about each: the hash of a written file, the hash of what a skipped file holds on disk, and the
 * entries a merged file contributes. */
export class TrackedConfigFiles {
  constructor(
    private readonly fs: FileReader & FileWriter & FileMerger,
    private readonly logger: Logger
  ) {}

  /** `is-user-owned` answers whether the file exists without the manifest tracking it, which marks
   * it as the user's: it is left alone and a warning says so. `write-and-track` answers the files
   * to record, `merge-and-track` the entries the merged files now hold. */
  async execute(command: TrackedConfigFilesRequest): Promise<boolean>;
  async execute(command: WriteAndTrackCommand): Promise<InstallationFile[]>;
  async execute(command: MergeAndTrackCommand): Promise<MergeFileEntry[]>;
  async execute(
    command: TrackedConfigFilesCommand
  ): Promise<boolean | InstallationFile[] | MergeFileEntry[]> {
    switch (command.kind) {
      case "is-user-owned":
        return this.isUserOwned(command);
      case "write-and-track":
        return this.writeAndTrack(command);
      case "merge-and-track":
        return this.mergeAndTrack(command);
    }
  }

  private async isUserOwned({
    relativePath,
    projectRoot,
    manifest,
  }: TrackedConfigFilesRequest): Promise<boolean> {
    if (!(await this.fs.fileExists(join(projectRoot, relativePath)))) return false;
    if (manifest.isFileTracked(relativePath)) return false;
    this.logger.warn(`Skipping ${relativePath} — exists but not tracked by aidd`);
    return true;
  }

  /** Writes each file the gate lets through. A file the gate skips stays as it is on disk and is
   * tracked by the hash it holds there. */
  private async writeAndTrack({
    files,
    projectRoot,
    onBeforeWrite,
  }: WriteAndTrackCommand): Promise<InstallationFile[]> {
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
  private async mergeAndTrack({
    files,
    projectRoot,
  }: MergeAndTrackCommand): Promise<MergeFileEntry[]> {
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
