import type { ConfigAsset, FileHash } from "../../../kernel/file.js";
import type { FlatHooksLoaderEntry } from "../../../kernel/materialization/flat-paths.js";
import type { MergeStrategy } from "../../../kernel/merge.js";
import type { AiToolId, IdeToolId, ToolId } from "../../../kernel/tool.js";
import type { FlatHooksBridge, ToolBuildContract } from "./build-contract.js";
import type { GlobalFiles, ProjectHooksLocation, SignalDirectory } from "./tool-vocabulary.js";

/** One variable, as the caller reads it: a profile is a declaration and reaches no global. */
export type EnvironmentReader = (name: string) => string | undefined;

/** How a tool takes plugins, asked and never read: each answer is a method. */
export interface PluginDelivery {
  /** Whether `--scope user` has anywhere to point this tool. */
  supportsUserScopeActivation(): boolean;
  /** Whether a machine-scope install writes the plugin's files itself. */
  copiesFilesGlobally(): boolean;
  /** Where a machine-scope install puts a plugin's files under `homedir`, or null for none. */
  userPluginsBaseDir(homedir: string): string | null;
  /** What a machine-scope install copies into the user's configuration directory, or null for none. */
  globalFiles(): GlobalFiles | null;
  hooksAcceptance(): HooksAcceptance;
  /** Whether its hooks are merged into the project's own hooks file rather than the plugin's directory. */
  deliversHooksToProject(): boolean;
}

/** What a tool's own plugin CLI declares about itself. */
export interface NativeActivationAnswers {
  /** The executable the host's own plugin CLI is run by: the key its driver and registry answer to. */
  hostBinary(): string;
  /** Whether the host's own CLI can update one installed plugin ref. */
  refreshesOnePlugin(): boolean;
  /** Whether the host keeps a registry of marketplaces that this CLI can read. */
  keepsMarketplaceRegistry(): boolean;
  /** Where the host leaves its plugin cache under `home`, or undefined when it declares none. */
  pluginCacheRoot(home: string): string | undefined;
  /** The host's own user-scope settings file under `home`, or undefined when none is declared. */
  userSettingsFile(home: string, env: EnvironmentReader): string | undefined;
}

/** Output layout: a marketplace dist versus a flat workspace inject. */
export const FRAMEWORK_BUILD_MODES = ["marketplace", "flat"] as const;
export type FrameworkBuildMode = (typeof FRAMEWORK_BUILD_MODES)[number];

/** Whether a delivered hook runs on this tool, and why not when it does not. */
export type HooksAcceptance = { accepts: true } | { accepts: false; reason: string };

/** Flat skills go under `skills/<plugin>/`, or `skills/<plugin>-<skill>/` for a shallow-scan tool. */
export type FlatSkillLayout = "nested" | "single-level";

/** Where a flat-mode plugin lands and how its hooks are loaded; each part is `null` or
 * `"nested"` when the mode has none. */
export interface FlatLayout {
  skillLayout: FlatSkillLayout;
  namespacePrefix: string | null;
  hooksDir: string | null;
  hooksLoaderEntry: FlatHooksLoaderEntry | null;
  hooksBridge: FlatHooksBridge | null;
}

/** A tool that installs a plugin through its own plugin CLI, as an outside caller asks it. */
export interface NativePluginAnswers extends PluginDelivery {
  readonly kind: "native";
  /** Whether a plugin installed fresh lands at user scope, the only scope this tool takes. */
  requiresUserScope(): boolean;
  /** Whether the plugin is installed by registering a marketplace with the host. */
  translatesAsMarketplace(): boolean;
  /** The directory a plugin's files land in. */
  pluginOutputDir(pluginName: string): string;
  /** The manifest file relative to that directory, or null when the tool takes none. */
  manifestPath(): string | null;
  /** The variable a hook or mcp manifest names the plugin root by. */
  rootToken(): string;
  /** What a person must still do before a delivered hook runs, or null. */
  trustNotice(): string | null;
  mcpFile(): { accepts: boolean; relativePath: string };
  hooksFilePath(): string;
  hookScript(pluginPath: string, content: string): string;
}

/** A tool whose plugins are injected into the project tree, as an outside caller asks it. */
export interface FlatPluginAnswers extends PluginDelivery {
  readonly kind: "flat";
  flatLayout(): FlatLayout;
  hookScript(pluginPath: string, content: string): string;
}

/** A tool that takes no plugin. */
export interface UnsupportedPluginAnswers extends PluginDelivery {
  readonly kind: "unsupported";
}

export type PluginAnswers = NativePluginAnswers | FlatPluginAnswers | UnsupportedPluginAnswers;

/** A markdown section (commands, agents, rules) a tool declares. */
export interface MarkdownSectionAnswers {
  /** Where a built file lands, or null when the tool takes none by that name. */
  buildInstallPath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>, fileName: string): Record<string, unknown>;
  serialize(fm: Record<string, unknown>, body: string): string;
}

/** The skills section a tool declares. */
export interface SkillsSectionAnswers {
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
  serialize(fm: Record<string, unknown>, body: string): string;
}

/** What merging a plugin's mcp servers into a tool's shared file produced. */
export interface McpPluginMerge {
  mergedContent: string;
  contributedEntries: ReadonlyMap<string, string>;
  collisions: ReadonlyArray<string>;
  editedPreviousEntries: ReadonlyArray<string>;
}

/** A tool's mcp file, as an install asks it. */
export interface McpConfigAnswers {
  /** Whether the tool takes the framework config artifact named `configName` into this file. */
  consumes(configName: string): boolean;
  mergeStrategy(): "user-prime" | "framework-prime" | "none";
  /** Whether the tool keeps the framework half of one file it shares with its plugins. */
  isFrameworkPrime(): boolean;
  /** A plugin's mcp json rewritten to this tool's own shape. */
  transform(mcpJson: string): string;
  /** Adds the plugin's transformed servers to the existing file: what the plugin contributed
   * before is replaced, a user-owned server is kept and reported as a collision. */
  mergePluginServers(
    existing: string | null,
    incomingTransformed: string,
    previousEntries: ReadonlyMap<string, string>,
    hasher: { hash(content: string): FileHash }
  ): McpPluginMerge;
  /** Removes the servers a plugin contributed, refusing one edited since. */
  removePluginServers(existing: string, entries: ReadonlyMap<string, string>): string;
  /** The project-relative file the tool's mcp servers live in. */
  outputPath(): string;
  /** Whether the config asset named `fileName` is that file, merged over what a person keeps. */
  isFrameworkPrimeJson(fileName: string): boolean;
  /** The file a project already keeps its mcp servers in, `exists` asking the project. */
  resolveOutputPath(exists: (relativePath: string) => Promise<boolean>): Promise<string>;
  /** The tool's framework-owned config merged over what a person already keeps in the file. */
  frameworkConfigOver(
    baseConfig: string,
    existing: string | null,
    incoming: Record<string, unknown>
  ): string;
}

/** A settings file a tool writes, as an install asks it. */
export interface SettingsFileAnswers {
  /** Whether the tool takes the framework config artifact named `configName` into this file. */
  consumes(configName: string): boolean;
  /** The tool that must be installed for this file to apply, or null. */
  requiredTool(): ToolId | null;
  outputPath(): string;
  mergeStrategy(): MergeStrategy;
  /** The file's fixed content, loaded through `loadAsset` when it lives in an asset. */
  resolveStaticContent(loadAsset?: (fileName: string) => ConfigAsset): string | null;
}

/** A hooks file a tool writes, as an install asks it. */
export interface HooksFileAnswers {
  /** Whether the tool takes the framework config artifact named `configName` into this file. */
  consumes(configName: string): boolean;
  outputPath(): string;
  mergeStrategy(): "user-prime" | "none";
}

/** One config file a tool writes. The list a tool answers is in the order they claim a config
 * artifact: the first that consumes it writes it. */
export type ConfigWrite =
  | { readonly kind: "mcp"; readonly capability: McpConfigAnswers }
  | { readonly kind: "hooks"; readonly capability: HooksFileAnswers }
  | { readonly kind: "settings"; readonly capability: SettingsFileAnswers };

/** An AI assistant, as an outside caller asks it. */
export interface AiToolProfile {
  readonly kind: "ai";
  readonly toolId: AiToolId;
  /** Where a built file lands, relative to the project root, ending in a slash. */
  readonly directory: string;
  /** Where this tool's plugin manifest and marketplace catalog sit inside a distribution it
   * produced. Order is irrelevant: the collected probes are sorted deepest first. */
  readonly distributionProbes?: {
    readonly manifest?: readonly string[];
    readonly marketplace?: readonly string[];
  };
  /** Flat when its plugins are injected into the project tree, a marketplace otherwise. */
  frameworkBuildMode(): FrameworkBuildMode;
  /** The framework-build contract for `mode`, or null when the tool declares none for it. */
  buildContract(mode: FrameworkBuildMode): ToolBuildContract | null;
  /** Rewrites source content to this tool's own conventions. */
  rewriteContent(content: string): string;
  /** The tool's plugin delivery, or null when it declares none. */
  plugins(): PluginAnswers | null;
  /** Whether `--scope user` has anywhere to point this tool: false when it declares no plugins. */
  supportsUserScopeActivation(): boolean;
  /** The commands, agents or rules section the tool declares, or null. */
  markdownSection(kind: "commands" | "agents" | "rules"): MarkdownSectionAnswers | null;
  /** The skills section the tool declares, or null. */
  skillsSection(): SkillsSectionAnswers | null;
  /** The tool's native plugin CLI declaration, or undefined when it has none. */
  nativeActivation(): NativeActivationAnswers | undefined;
  /** Whether a ref the host's registry lists is a plugin in use: an enabled one always, a disabled
   * one unless the host's uninstall leaves refs disabled. Every ref counts for a tool with no native CLI. */
  hostRefInUse(enabled: boolean): boolean;
  /** The config files an install writes, by asset name: the tool's own, then the runtime
   * modules its plugins need. */
  configFiles(): Readonly<Record<string, string>>;
  /** The runtime modules its plugins need, by asset name. */
  runtimeFiles(): Readonly<Record<string, string>>;
  /** The mcp file the tool declares, or null. */
  mcpConfig(): McpConfigAnswers | null;
  /** The settings files the tool declares, none when it declares none. */
  settingsFiles(): readonly SettingsFileAnswers[];
  /** The config files an install writes: mcp, then hooks, then each settings file. */
  configWrites(): readonly ConfigWrite[];
  /** The files its marketplace registration keeps on this machine, none when it keeps none. */
  machineLocalFiles(): readonly string[];
  /** The marketplace names a parsed settings file declares, none for a tool keeping no registration. */
  declaredMarketplaceNames(parsed: unknown): ReadonlySet<string>;
  /** Where it takes a plugin's hooks inside the project, or null when it takes none there. */
  projectHooksDelivery(): ProjectHooksLocation | null;
  /** Where its installed rules live and what they end in, or null when it installs none. */
  installedRulesLocation(): { readonly directory: string; readonly extension: string } | null;
  /** Whether enabling a plugin acts on the whole machine: its own CLI takes no scope, or it has none. */
  pluginEnablementIsMachineGlobal(): boolean;
  /** Where its own commands sit in the project at `projectRoot`, or null when it declares none. */
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
}

/** An editor, as an outside caller asks it. */
export interface IdeToolProfile {
  readonly kind: "ide";
  readonly toolId: IdeToolId;
  /** Where a built file lands, relative to the project root, ending in a slash. */
  readonly directory: string;
  /** The settings files the tool declares, none when it declares none. */
  settingsFiles(): readonly SettingsFileAnswers[];
  /** The config files an install writes: each settings file. */
  configWrites(): readonly ConfigWrite[];
  /** Where its own commands sit in the project at `projectRoot`, or null when it declares none. */
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
}

export type ToolProfile = AiToolProfile | IdeToolProfile;
