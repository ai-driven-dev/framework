import type { FileHash } from "../models/file-hash.js";
import type { MergeStrategy } from "../models/merge-strategy.js";

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
}
