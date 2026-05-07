import type { FileHash } from "../models/file.js";
import type { MergeStrategy } from "../models/merge.js";

/**
 * Deliberate exception to the ≤5 method port rule.
 * FileSystem covers read, write, hash, merge, permissions, and directory ops —
 * splitting into FileReader / FileWriter / FileMerger would require injecting
 * three ports wherever one is needed today. Full split is deferred and tracked
 * separately. All other ports must still respect ≤5 methods.
 */
export interface FileSystem {
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  deleteEmptyDirectories(path: string): Promise<void>;
  readFile(path: string): Promise<string>;
  listDirectory(path: string): Promise<string[]>;
  fileExists(path: string): Promise<boolean>;
  readFileHash(path: string): Promise<FileHash>;
  mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  chmodExecutable(path: string): Promise<void>;
  backup(absolutePath: string): Promise<string>;
  hasLocalChanges(path: string, knownHash: FileHash): Promise<boolean>;
  listFilesRecursive(dirPath: string): Promise<string[]>;
}
