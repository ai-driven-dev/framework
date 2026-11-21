import { dirname, join } from "node:path";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../../shared/domain/merge.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";

type MergeFileSystem = FileReader & FileWriter;

/** Removes the keys the install merged into each shared file and returns how many files existed. */
export async function cleanMergeFileKeys(
  fs: MergeFileSystem,
  mergeFiles: readonly MergeFileEntry[],
  projectRoot: string
): Promise<number> {
  let count = 0;
  for (const mergeFile of mergeFiles) {
    const fullPath = join(projectRoot, mergeFile.relativePath);
    if (!(await fs.fileExists(fullPath))) continue;
    await applyMergeFileCleaning(fs, fullPath, mergeFile);
    count++;
  }
  return count;
}

async function applyMergeFileCleaning(
  fs: MergeFileSystem,
  fullPath: string,
  mergeFile: MergeFileEntry
): Promise<void> {
  const keys = Object.keys(mergeFile.entries);
  const cleaned =
    keys.length === 0
      ? null
      : removeEntriesFromJson(await fs.readFile(fullPath), mergeFile.sectionKey, keys);
  if (cleaned === null || isMergeContentEmpty(cleaned, mergeFile.sectionKey)) {
    await fs.deleteFile(fullPath);
    await fs.deleteEmptyDirectories(dirname(fullPath));
    return;
  }
  await fs.writeFile(fullPath, cleaned);
}
