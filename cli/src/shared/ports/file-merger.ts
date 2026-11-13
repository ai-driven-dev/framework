import type { MergeStrategy } from "../domain/merge.js";

export interface FileMerger {
  mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void>;
}
