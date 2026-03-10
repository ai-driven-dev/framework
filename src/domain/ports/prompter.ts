export interface Prompter {
  resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite">;
}
