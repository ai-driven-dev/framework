import { join } from "node:path";
import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import {
  extractMergeEntries,
  type MergeFileEntry,
  type MergeStrategy,
} from "../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import { type DriftVerdict, driftOfKeys } from "../../domain/manifest/drift.js";
import { planRestore, type RecordedVerdict } from "../../domain/manifest/restore-plan.js";
import type { FileMerger } from "../../ports/file-merger.js";
import type { ConflictResolver } from "./resolve-restore-decision.js";
import type { DriftCollection, DriftDescriptor } from "./restore-drift-entries.js";
import { restoreDriftEntries } from "./restore-drift-entries.js";

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

export async function restoreMergeFiles(
  fs: FileReader & FileMerger,
  conflicts: ConflictResolver,
  options: RestoreMergeFilesCommand
): Promise<RestoreMergeFilesResult | null> {
  const mergeMap = new Map(options.mergeFiles.map((m) => [m.relativePath, m]));

  return restoreDriftEntries(
    conflicts,
    {
      collectDrift: () => collectMergeDrift(fs, options),
      restore: (entry) =>
        applyOneMergeRestore(fs, entry, { projectRoot: options.projectRoot, mergeMap }),
      buildResult: (restored, kept, unrestorable) => ({
        restored,
        kept,
        unrestorable,
        updatedMergeFiles: [...mergeMap.values()],
      }),
    },
    options
  );
}

async function collectMergeDrift(
  fs: FileReader,
  options: RestoreMergeFilesCommand
): Promise<DriftCollection<MergeDriftEntry>> {
  const { distMap } = options;
  const { recorded, entries } = await recordMergeVerdicts(fs, options);

  // A file the current distribution no longer merge-tracks (dropped, or its
  // strategy became "none") has nothing left to restore drift from.
  const distributed = new Set(
    [...distMap.values()].filter((f) => f.mergeStrategy !== "none").map((f) => f.relativePath)
  );
  const drift: MergeDriftEntry[] = [];
  const unrestorable: DriftDescriptor[] = [];
  for (const step of planRestore(recorded, distributed)) {
    const entry = entries.get(step.relativePath);
    const distFile = distMap.get(step.relativePath);
    if (step.kind === "rewrite" && entry && distFile) {
      drift.push({
        relativePath: step.relativePath,
        content: distFile.content,
        reason: step.reason,
        mergeStrategy: distFile.mergeStrategy,
        sectionKey: entry.sectionKey,
      });
    } else {
      unrestorable.push({ relativePath: step.relativePath, reason: step.reason });
    }
  }
  return { drift, unrestorable };
}

async function mergeVerdictOf(
  fs: FileReader,
  entry: MergeFileEntry,
  projectRoot: string
): Promise<DriftVerdict> {
  const diskPath = join(projectRoot, entry.relativePath);
  if (!(await fs.fileExists(diskPath))) return "missing";
  const diskContent = await fs.readFile(diskPath);
  return driftOfKeys(entry.entries, extractMergeEntries(diskContent, entry.sectionKey));
}

async function applyOneMergeRestore(
  fs: FileMerger & FileReader,
  entry: MergeDriftEntry,
  target: { projectRoot: string; mergeMap: Map<string, MergeFileEntry> }
): Promise<void> {
  const { projectRoot, mergeMap } = target;
  const fullPath = join(projectRoot, entry.relativePath);
  await fs.mergeJsonFile(fullPath, entry.content, entry.mergeStrategy);
  const mergedContent = await fs.readFile(fullPath);
  const newEntries = extractMergeEntries(mergedContent, entry.sectionKey);
  mergeMap.set(entry.relativePath, {
    relativePath: entry.relativePath,
    sectionKey: entry.sectionKey,
    entries: newEntries,
  });
}

async function recordMergeVerdicts(
  fs: FileReader,
  { mergeFiles, projectRoot, fileFilter }: RestoreMergeFilesCommand
): Promise<{ recorded: RecordedVerdict[]; entries: Map<string, MergeFileEntry> }> {
  const recorded: RecordedVerdict[] = [];
  const entries = new Map<string, MergeFileEntry>();
  for (const entry of mergeFiles) {
    if (fileFilter && !fileFilter(entry.relativePath)) continue;
    entries.set(entry.relativePath, entry);
    recorded.push({
      relativePath: entry.relativePath,
      verdict: await mergeVerdictOf(fs, entry, projectRoot),
    });
  }
  return { recorded, entries };
}
