export interface Prompter {
  resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite">;
  confirm(message: string): Promise<boolean>;
  input(message: string, defaultValue?: string): Promise<string>;
  select<T>(
    message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean | string; description?: string }>
  ): Promise<T>;
  checkbox<T>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]>;
}
