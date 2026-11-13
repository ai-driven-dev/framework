import type { MergeStrategy } from "../../../../shared/domain/merge.js";

export interface FileMerger {
  mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void>;
}
