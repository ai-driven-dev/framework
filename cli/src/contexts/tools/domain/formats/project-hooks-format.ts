export type ProjectHookEntry = { command: string; [key: string]: unknown };

export interface ProjectHooksFormat {
  merge(
    existingJson: string | null,
    pluginHooksJson: string,
    pluginName: string
  ): { content: string; warnings: readonly string[] };
  unmerge(existingJson: string, pluginName: string): string;
  contributedEntries(
    content: string,
    pluginName: string
  ): readonly { event: string; entry: ProjectHookEntry }[];
  isEmpty(content: string): boolean;
  scriptPath(pluginName: string, hooksRelativePath: string): string;
  scriptDir(pluginName: string): string;
}
