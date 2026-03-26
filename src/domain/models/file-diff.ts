export type FileDiffKind = "added" | "removed" | "changed" | "unchanged";

export interface FileDiff {
  relativePath: string;
  kind: FileDiffKind;
  conflict?: boolean;
}
