import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type { MarketplaceSettings } from "../marketplace-settings.js";
import type { PluginTranslationMode } from "../plugin-translation-mode.js";
import type { NativeActivationSpec } from "./native-activation.js";

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

/** A hook lands in the plugin's own dir, or merged into the project hooks file measured to fire. */
export interface ProjectHooksDelivery {
  hooksDestination?: "plugin" | "project";
  projectHooksRelativePath?: string;
  projectHooksFormat?: ProjectHooksFormat;
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

/**
 * The global-file mapping of a flat tool whose user configuration directory takes the same
 * `skills/` and `agents/` its project directory does (OpenCode, Kilo): a plugin's skills and
 * agents under `directory` keep their path below it. Hooks, commands and MCP entries stay
 * project-scoped.
 */
export function flatGlobalFilePath(directory: string): GlobalFiles["map"] {
  return (builtPath, plugin) => {
    if (!builtPath.startsWith(directory)) return null;
    const relative = builtPath.slice(directory.length);
    if (relative.startsWith(`skills/${plugin.name}/`)) return relative;
    const agent = /^agents\/(.+)\.md$/.exec(relative)?.[1];
    if (agent === undefined || !agent.startsWith(`${plugin.name}-`)) return null;
    return plugin.agents.has(agent.slice(plugin.name.length + 1)) ? relative : null;
  };
}

/** Shared by every mode: where a tool's machine-scope files go, when it has any. */
interface GlobalFilesParams {
  globalFiles?: GlobalFiles;
}

export interface NativePluginsParams extends ProjectHooksDelivery {
  mode: "native";
  pluginsDir: string;
  /** Set to `null` to suppress writing a plugin manifest file into the plugin directory. */
  pluginManifestRelativePath: string | null;
  mcpRelativePath?: string;
  hooksRelativePath?: string;
  acceptsMcp?: boolean;
  /** The variable this tool expands to the installed plugin's directory, as written in a
   * hook or MCP command. */
  pluginRootToken: string;
  /** See {@link NativePlugins.hookScript}. */
  hookScript?: HookScript;
  marketplaceSettings?: MarketplaceSettings;
  /** Enables native CLI-driven plugin activation. See {@link NativeActivationSpec}. */
  nativeActivation?: NativeActivationSpec;
  /** Pass `"marketplace"` alongside `marketplaceSettings` for Mode A routing. Defaults to
   * `null`, neutral native, where no translation strategy applies. */
  translationMode?: PluginTranslationMode;
  /** `"user"` installs plugins relative to the home directory and requires `userPluginsDir`;
   * defaults to `"project"`. */
  installScope?: "project" | "user";
  /** Absolute user-scope plugins base directory, given a homedir. Required when
   * `installScope === "user"`. */
  userPluginsDir?: (homedir: string) => string;
}

/**
 * A generated event bridge, for a flat loader that scans no "hooks" family and reads no
 * hooks.json of its own. Both flat-materialization routes read it, so one plugin looks the
 * same whichever route installed it.
 */
export interface FlatHooksBridge {
  /** Raw (unrewritten) hooks.json content + plugin name -> the generated bridge module's
   * full text, or `null` when nothing in it named an event the bridge maps. */
  readonly generate: (rawHooksJson: string, plugin: string) => string | null;
  /** Output path for the generated bridge module, relative to the project root. */
  readonly path: (plugin: string) => string;
  /** A hooks/ file whose presence in this plugin's own source means it ships its own bridge
   * already — generate nothing for it. */
  readonly skipIfSourceHas: string;
}

export type FlatHooksSupport =
  | ({
      acceptsHooks: true;
      flatHooksDir: string;
      /**
       * The loader's own plugin module: the runtime the loader itself imports, not a script
       * a bridge must be told to run. Omit where the loader has no such convention.
       */
      flatHooksLoaderEntry?: FlatHooksLoaderEntry;
      /** See {@link FlatHooksBridge}. Omit when this loader triggers a plugin's hooks some
       * other way. */
      flatHooksBridge?: FlatHooksBridge;
      /** See {@link FlatPlugins.hookScript}. */
      hookScript?: HookScript;
    } & ProjectHooksDelivery)
  | { acceptsHooks: false; hooksUnsupportedReason: string };

/** Flat skills go under `skills/<plugin>/`, or `skills/<plugin>-<skill>/` for a shallow-scan tool. */
export type FlatSkillLayout = "nested" | "single-level";

export type FlatPluginsParams = {
  mode: "flat";
  flatNamespacePrefix: string;
  flatSkillLayout?: FlatSkillLayout;
} & FlatHooksSupport;

export interface UnsupportedPluginsParams {
  mode: "unsupported";
  /** See {@link FlatPluginsParams.hooksUnsupportedReason}. */
  hooksUnsupportedReason: string;
}

/**
 * Whether this tool runs the hooks a plugin ships. Stated, never defaulted: a tool nobody
 * considered loses its hooks quietly when the field falls back to `false`.
 * `hooksTrustNotice` is the opposite case — the tool runs a delivered hook, but only once a
 * per-hook trust a headless run is never prompted for is granted (measured on Codex: four
 * clean `codex exec` sessions ran none of the hooks until `--dangerously-bypass-hook-trust` did).
 */
export type HooksSupport =
  | { acceptsHooks: true; hooksTrustNotice?: string }
  | { acceptsHooks: false; hooksUnsupportedReason: string };

export type NativeParams = NativePluginsParams & HooksSupport & GlobalFilesParams;
export type FlatParams = FlatPluginsParams & GlobalFilesParams;
export type UnsupportedParams = UnsupportedPluginsParams & GlobalFilesParams;

export type PluginsParams = NativeParams | FlatParams | UnsupportedParams;
