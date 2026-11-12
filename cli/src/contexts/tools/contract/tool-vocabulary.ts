/** A hook script as the tool runs it, given its path in the plugin and its shipped content. */
export type HookScript = (pluginPath: string, content: string) => string;

/** One entry a plugin contributed to a project hooks file, as that file holds it. */
export type ProjectHookEntry = { command: string; [key: string]: unknown };

/**
 * How a tool's project-scope hooks file takes one plugin's hooks and gives them back: the
 * merge rewrites the plugin's commands to where its scripts land and keeps the plugin's own
 * earlier entries from doubling; the unmerge removes this plugin's entries alone.
 */
export interface ProjectHooksFormat {
  merge(
    existingJson: string | null,
    pluginHooksJson: string,
    pluginName: string
  ): { content: string; warnings: readonly string[] };
  unmerge(existingJson: string, pluginName: string): string;
  /** The entries this plugin contributed, each under the event the file holds it in. */
  contributedEntries(
    content: string,
    pluginName: string
  ): readonly { event: string; entry: ProjectHookEntry }[];
  /** Whether the file holds no entry at all, so removing it loses nothing. */
  isEmpty(content: string): boolean;
  /** Where a hook script lands in the project, given its path relative to the plugin root. */
  scriptPath(pluginName: string, hooksRelativePath: string): string;
  /** The directory holding one plugin's copied scripts, which nothing else writes to. */
  scriptDir(pluginName: string): string;
}

/** Where a tool takes a plugin's hooks inside the project, and how it names itself in a refusal. */
export interface ProjectHooksLocation {
  relativePath: string;
  format: ProjectHooksFormat;
  toolName: string;
  hookScript: HookScript;
}
