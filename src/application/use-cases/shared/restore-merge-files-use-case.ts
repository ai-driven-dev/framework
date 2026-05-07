import { join } from "node:path";
import type { InstallationFile } from "../../../domain/models/file.js";
import {
  extractMergeEntries,
  type MergeFileEntry,
  type MergeStrategy,
} from "../../../domain/models/merge.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import { ResolveRestoreDecisionUseCase } from "./resolve-restore-decision.js";

interface MergeDriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
  mergeStrategy: MergeStrategy;
  sectionKey: string | null;
}

interface MergeFilesRestoreOptions {
  mergeFiles: readonly MergeFileEntry[];
  distMap: Map<string, InstallationFile>;
  projectRoot: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
}

export interface MergeFilesRestoreResult {
  restored: string[];
  kept: string[];
  updatedMergeFiles: MergeFileEntry[];
}

export class RestoreMergeFilesUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly prompter: Prompter
  ) {}

  async execute(options: MergeFilesRestoreOptions): Promise<MergeFilesRestoreResult | null> {
    const drift = await this.collectMergeDrift(
      options.mergeFiles,
      options.distMap,
      options.projectRoot,
      options.fileFilter
    );
    if (drift.length === 0) return null;
    return this.applyMergeRestorations(
      drift,
      options.mergeFiles,
      options.projectRoot,
      options.force,
      options.interactive
    );
  }

  private async collectMergeDrift(
    mergeFiles: readonly MergeFileEntry[],
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<MergeDriftEntry[]> {
    const drift: MergeDriftEntry[] = [];
    for (const entry of mergeFiles) {
      if (fileFilter && !fileFilter(entry.relativePath)) continue;
      const distFile = distMap.get(entry.relativePath);
      if (!distFile || distFile.mergeStrategy === "none") continue;
      const driftEntry = await this.checkOneMergeFileDrift(entry, distFile, projectRoot);
      if (driftEntry) drift.push(driftEntry);
    }
    return drift;
  }

  private async checkOneMergeFileDrift(
    entry: MergeFileEntry,
    distFile: InstallationFile,
    projectRoot: string
  ): Promise<MergeDriftEntry | null> {
    const diskPath = join(projectRoot, entry.relativePath);
    const diskExists = await this.fs.fileExists(diskPath);
    if (!diskExists) {
      return {
        relativePath: entry.relativePath,
        content: distFile.content,
        reason: "deleted",
        mergeStrategy: distFile.mergeStrategy,
        sectionKey: entry.sectionKey,
      };
    }
    const diskContent = await this.fs.readFile(diskPath);
    const diskEntries = extractMergeEntries(diskContent, entry.sectionKey, this.hasher);
    const hasDrift = Object.keys(entry.entries).some(
      (key) => diskEntries[key]?.value !== entry.entries[key].value
    );
    if (!hasDrift) return null;
    return {
      relativePath: entry.relativePath,
      content: distFile.content,
      reason: "modified",
      mergeStrategy: distFile.mergeStrategy,
      sectionKey: entry.sectionKey,
    };
  }

  private async applyMergeRestorations(
    drift: MergeDriftEntry[],
    mergeFiles: readonly MergeFileEntry[],
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<MergeFilesRestoreResult> {
    const restored: string[] = [];
    const kept: string[] = [];
    const mergeMap = new Map(mergeFiles.map((m) => [m.relativePath, m]));
    for (const entry of drift) {
      const skip = await new ResolveRestoreDecisionUseCase(this.prompter).execute({
        relativePath: entry.relativePath,
        reason: entry.reason,
        force,
        interactive,
      });
      if (skip) {
        kept.push(entry.relativePath);
        continue;
      }
      await this.applyOneMergeRestore(entry, projectRoot, mergeMap);
      restored.push(entry.relativePath);
    }
    return { restored, kept, updatedMergeFiles: [...mergeMap.values()] };
  }

  private async applyOneMergeRestore(
    entry: MergeDriftEntry,
    projectRoot: string,
    mergeMap: Map<string, MergeFileEntry>
  ): Promise<void> {
    const fullPath = join(projectRoot, entry.relativePath);
    await this.fs.mergeJsonFile(fullPath, entry.content, entry.mergeStrategy);
    const mergedContent = await this.fs.readFile(fullPath);
    const newEntries = extractMergeEntries(mergedContent, entry.sectionKey, this.hasher);
    mergeMap.set(entry.relativePath, {
      relativePath: entry.relativePath,
      sectionKey: entry.sectionKey,
      entries: newEntries,
    });
  }
}
