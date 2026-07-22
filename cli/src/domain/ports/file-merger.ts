import type { FileHash } from "../models/file.js";
import type { MergeStrategy } from "../models/merge.js";

export interface FileMerger {
  mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void>;
  backup(absolutePath: string): Promise<string>;
  hasLocalChanges(path: string, knownHash: FileHash): Promise<boolean>;
}
