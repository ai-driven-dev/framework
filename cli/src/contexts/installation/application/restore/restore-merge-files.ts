import { join } from "node:path";
import type { InstallationFile } from "../../../../shared/domain/file.js";
import {
  extractMergeEntries,
  type MergeFileEntry,
  type MergeStrategy,
} from "../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import { driftOfKeys } from "../../domain/manifest/drift.js";
import type { FileMerger } from "../../ports/file-merger.js";
import type { DriftCollection, DriftDescriptor } from "./restore-drift-entries.js";
import { RestoreDriftEntries } from "./restore-drift-entries.js";

interface MergeDriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
  mergeStrategy: MergeStrategy;
  sectionKey: string | null;
}

interface RestoreMergeFilesCommand {
  mergeFiles: readonly MergeFileEntry[];
  distMap: Map<string, InstallationFile>;
  projectRoot: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
}

export interface RestoreMergeFilesResult {
  restored: string[];
  kept: string[];
  unrestorable: string[];
  updatedMergeFiles: MergeFileEntry[];
}

export class RestoreMergeFiles {
  private readonly restoreDriftEntries: RestoreDriftEntries;

  constructor(
    private readonly fs: FileReader & FileMerger,
    prompter: Prompter
  ) {
    this.restoreDriftEntries = new RestoreDriftEntries(prompter);
  }

  async execute(options: RestoreMergeFilesCommand): Promise<RestoreMergeFilesResult | null> {
    const mergeMap = new Map(options.mergeFiles.map((m) => [m.relativePath, m]));

    return this.restoreDriftEntries.execute(
      {
        collectDrift: () =>
          this.collectMergeDrift(
            options.mergeFiles,
            options.distMap,
            options.projectRoot,
            options.fileFilter
          ),
        restore: (entry) => this.applyOneMergeRestore(entry, options.projectRoot, mergeMap),
        buildResult: (restored, kept, unrestorable) => ({
          restored,
          kept,
          unrestorable,
          updatedMergeFiles: [...mergeMap.values()],
        }),
      },
      options.force,
      options.interactive
    );
  }

  private async collectMergeDrift(
    mergeFiles: readonly MergeFileEntry[],
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<DriftCollection<MergeDriftEntry>> {
    const drift: MergeDriftEntry[] = [];
    const unrestorable: DriftDescriptor[] = [];
    for (const entry of mergeFiles) {
      if (fileFilter && !fileFilter(entry.relativePath)) continue;
      const reason = await this.detectMergeDrift(entry, projectRoot);
      if (reason === null) continue;

      // A file the current distribution no longer merge-tracks (dropped, or its
      // strategy became "none") has nothing left to restore drift from.
      const distFile = distMap.get(entry.relativePath);
      if (!distFile || distFile.mergeStrategy === "none") {
        unrestorable.push({ relativePath: entry.relativePath, reason });
        continue;
      }
      drift.push(this.buildDriftEntry(entry, distFile, reason));
    }
    return { drift, unrestorable };
  }

  private async detectMergeDrift(
    entry: MergeFileEntry,
    projectRoot: string
  ): Promise<"deleted" | "modified" | null> {
    const diskPath = join(projectRoot, entry.relativePath);
    if (!(await this.fs.fileExists(diskPath))) return "deleted";
    const diskContent = await this.fs.readFile(diskPath);
    const verdict = driftOfKeys(entry.entries, extractMergeEntries(diskContent, entry.sectionKey));
    return verdict === "ok" ? null : "modified";
  }

  private buildDriftEntry(
    entry: MergeFileEntry,
    distFile: InstallationFile,
    reason: MergeDriftEntry["reason"]
  ): MergeDriftEntry {
    return {
      relativePath: entry.relativePath,
      content: distFile.content,
      reason,
      mergeStrategy: distFile.mergeStrategy,
      sectionKey: entry.sectionKey,
    };
  }

  private async applyOneMergeRestore(
    entry: MergeDriftEntry,
    projectRoot: string,
    mergeMap: Map<string, MergeFileEntry>
  ): Promise<void> {
    const fullPath = join(projectRoot, entry.relativePath);
    await this.fs.mergeJsonFile(fullPath, entry.content, entry.mergeStrategy);
    const mergedContent = await this.fs.readFile(fullPath);
    const newEntries = extractMergeEntries(mergedContent, entry.sectionKey);
    mergeMap.set(entry.relativePath, {
      relativePath: entry.relativePath,
      sectionKey: entry.sectionKey,
      entries: newEntries,
    });
  }
}
