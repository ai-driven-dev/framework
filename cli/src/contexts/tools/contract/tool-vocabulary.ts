import type { PluginSource } from "../../../kernel/source.js";

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

/** The directory a tool keeps its own commands in, from the project root and under it. */
export interface SignalDirectory {
  readonly absolute: string;
  readonly relative: string;
}

/** Where a tool takes a plugin's hooks inside the project, and how it names itself in a refusal. */
export interface ProjectHooksLocation {
  relativePath: string;
  format: ProjectHooksFormat;
  toolName: string;
  hookScript: HookScript;
}

/**
 * What a machine-scope install (`setup --global`) copies out of this tool's built tree into
 * the user's own configuration directory, for a host that loads those files from there rather
 * than from a plugin it enables itself: OpenCode's and Kilo's skills and agents, Codex's agents.
 */
export interface GlobalFiles {
  /** The user configuration directory the files land in, given a homedir. */
  readonly dir: (homedir: string) => string;
  /** A built-tree path (relative to the tool's built dir) to its path under `dir` for one
   * plugin, or `null` when that file is not this plugin's or is not installed machine-wide. */
  readonly map: (builtPath: string, plugin: GlobalPlugin) => string | null;
}

/** The plugin a global file is read for: its name, and the agents its source ships, by base
 * name. A flat build prefixes an agent with its plugin, so a prefix alone cannot tell
 * `aidd-dev`'s agents from those of a plugin named `aidd-dev-tools`. */
export interface GlobalPlugin {
  readonly name: string;
  readonly agents: ReadonlySet<string>;
}

/** `"marketplace"`: register a plugin reference in the tool's native config, writing no plugin
 * files. `"flat"`: materialize the plugin's content as files on disk. */
export type PluginTranslationMode = "marketplace" | "flat";

/** A marketplace as a tool's settings file keys it: its name and where it comes from. */
export interface MarketplaceSettingsInput {
  name: string;
  source: PluginSource;
}
