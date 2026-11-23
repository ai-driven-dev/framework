import { join } from "node:path";
import type { FileHash } from "../../../../shared/domain/file-hash.js";
import { extractMergeEntries, type MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import { driftOf } from "../../domain/drift.js";

export type FileStatusKind = "modified" | "deleted" | "added";

export interface FileDrift {
  relativePath: string;
  status: FileStatusKind;
}

function driftFor(relativePath: string, verdict: ReturnType<typeof driftOf>): FileDrift[] {
  if (verdict === "missing") return [{ relativePath, status: "deleted" }];
  if (verdict === "modified") return [{ relativePath, status: "modified" }];
  return [];
}

/** The tracked files whose content on disk is gone or no longer what the install wrote. */
export async function trackedFileDrift(
  fs: FileReader,
  files: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
  projectRoot: string
): Promise<FileDrift[]> {
  const drifted: FileDrift[] = [];
  for (const file of files) {
    const fullPath = join(projectRoot, file.relativePath);
    const onDisk = (await fs.fileExists(fullPath)) ? await fs.readFileHash(fullPath) : null;
    drifted.push(...driftFor(file.relativePath, driftOf(file.hash.value, onDisk)));
  }
  return drifted;
}

/** The merged keys whose value on disk is gone or no longer what the install merged. */
export async function mergeFileDrift(
  fs: FileReader,
  mergeFiles: readonly MergeFileEntry[],
  projectRoot: string
): Promise<FileDrift[]> {
  const drifted: FileDrift[] = [];
  for (const mergeFile of mergeFiles) {
    drifted.push(...(await oneMergeFileDrift(fs, mergeFile, projectRoot)));
  }
  return drifted;
}

async function oneMergeFileDrift(
  fs: FileReader,
  mergeFile: MergeFileEntry,
  projectRoot: string
): Promise<FileDrift[]> {
  const fullPath = join(projectRoot, mergeFile.relativePath);
  const diskEntries = (await fs.fileExists(fullPath))
    ? extractMergeEntries(await fs.readFile(fullPath), mergeFile.sectionKey)
    : {};
  return Object.entries(mergeFile.entries).flatMap(([key, manifestHash]) =>
    driftFor(
      `${mergeFile.relativePath} > ${key}`,
      driftOf(manifestHash.value, diskEntries[key] ?? null)
    )
  );
}

/** What to scan a tool directory for. */
export interface AddedFileScan {
  directory: string;
  isTracked: (relativePath: string) => boolean;
  projectRoot: string;
  // Written by this CLI on purpose and never tracked: reporting one as something the user added
  // would be a lie. The `.backup` skip below is not the same thing: nothing here writes such a
  // file, so it only spares one an older version left behind.
  machineLocal: readonly string[];
}

// User-scope plugin dirs (e.g. ~/.cursor/plugins/local/) are not scanned for added files;
// only tracked-file drift is detected for user-scope plugins.
export async function addedFileDrift(fs: FileReader, scan: AddedFileScan): Promise<FileDrift[]> {
  const { directory, isTracked, projectRoot, machineLocal } = scan;
  const toolDir = join(projectRoot, directory);
  if (!(await fs.fileExists(toolDir))) return [];
  const diskFiles = await fs.listDirectory(toolDir);
  return diskFiles
    .filter((diskRelPath) => !diskRelPath.endsWith(".backup"))
    .map((diskRelPath) => `${directory}${diskRelPath}`)
    .filter((fullRelPath) => !machineLocal.includes(fullRelPath) && !isTracked(fullRelPath))
    .map((relativePath) => ({ relativePath, status: "added" as const }));
}

/** The paths of drifted files a restore can bring back: the install wrote them, then they changed or vanished. */
export function restorableDrift(drift: readonly FileDrift[]): string[] {
  return drift.filter((d) => d.status !== "added").map((d) => d.relativePath);
}
