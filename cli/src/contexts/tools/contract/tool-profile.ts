import type { InstallationFile } from "../../../shared/domain/installation-file.js";
import type { ToolBuildContract } from "../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../shared/domain/materialization/flat-paths.js";
import type { LinkSyntax } from "../../../shared/domain/materialization/link-syntax.js";
import type { ConfigAsset } from "../../../shared/domain/reading/config-asset.js";
import type { AiToolId, IdeToolId } from "../../../shared/domain/tool.js";
import type { ConfigRef } from "./config-refs.js";
import type { GlobalFiles, ProjectHooksLocation, SignalDirectory } from "./tool-vocabulary.js";

/** How a tool takes plugins, asked and never read: each answer is a method. */
export interface PluginDelivery {
  /** Whether a plugin installed fresh lands at user scope, the only scope this tool takes. */
  requiresUserScope(): boolean;
  /** Whether an install copies the per-target built tree verbatim: a flat tool, or a native one
   * that installs at user scope. */
  materializesFromBuiltTree(): boolean;
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

/** Output layout: a marketplace dist versus a flat workspace inject. */
export const FRAMEWORK_BUILD_MODES = ["marketplace", "flat"] as const;
export type FrameworkBuildMode = (typeof FRAMEWORK_BUILD_MODES)[number];

/** Whether a delivered hook runs on this tool, and why not when it does not. */
export type HooksAcceptance = { accepts: true } | { accepts: false; reason: string };

/** Flat skills go under `skills/<plugin>/`, or `skills/<plugin>-<skill>/` for a shallow-scan tool. */
export type FlatSkillLayout = FlatArtifactLayout["skills"];

/** The sections a flat plugin's files are installed under. */
export type FlatInstallSection = "commands" | "agents" | "rules" | "skills";

/** Where a flat-mode plugin lands and how its hooks are loaded; each part is `null` or
 * `"nested"` when the mode has none. */
export interface FlatLayout {
  skillLayout: FlatSkillLayout;
  namespacePrefix: string;
  rules: FlatArtifactLayout["rules"];
}

/** A tool that installs a plugin through its own plugin CLI, as an outside caller asks it. */
export interface NativePluginAnswers extends PluginDelivery {
  readonly kind: "native";
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
  /** The tool's own writer for a document, when it keeps its header in a form of its own. */
  readonly serialize?: (fm: Record<string, unknown>, body: string) => string;
}

/** What merging a plugin's mcp servers into a tool's shared file produced. */
export interface McpPluginMerge {
  mergedContent: string;
  contributedEntries: ReadonlyMap<string, string>;
  collisions: ReadonlyArray<string>;
  editedPreviousEntries: ReadonlyArray<string>;
}

/** Where a config file lands when its own path is not the answer: the path resolved for it, and
 * the canonical file its content came from. */
export interface ConfigFilePlace {
  readonly relativePath?: string;
  readonly frameworkPath?: string;
}

/** A tool's mcp file, as an install asks it. */
export interface McpConfigAnswers {
  /** Whether the tool takes the framework config artifact named `configName` into this file. */
  consumes(configName: string): boolean;
  /** Every config artifact this file takes in, with where the canonical source keeps it. */
  consumedRefs(): readonly ConfigRef[];
  /** The file holding `content`, merged the tool's way, at its own path unless `place` names one. */
  fileOf(content: string, place?: ConfigFilePlace): InstallationFile;
  /** A plugin's mcp json rewritten to this tool's own shape. */
  transform(mcpJson: string): string;
  /** How a server launch is rewritten for `platform` once the tool's own transform has run,
   * or undefined when the platform needs none. */
  launchTransformFor(platform: string): ((content: string) => string) | undefined;
  /** Adds the plugin's transformed servers to the existing file: what the plugin contributed
   * before is replaced, a user-owned server is kept and reported as a collision. */
  mergePluginServers(
    existing: string | null,
    incomingTransformed: string,
    previousEntries: ReadonlyMap<string, string>
  ): McpPluginMerge;
  /** Removes the servers a plugin contributed, refusing one edited since. */
  removePluginServers(existing: string, entries: ReadonlyMap<string, string>): string;
  /** Whether `relativePath` is the project file the tool's mcp servers live in by default. */
  accepts(relativePath: string): boolean;
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
  /** Every config artifact this file takes in, with where the canonical source keeps it. */
  consumedRefs(): readonly ConfigRef[];
  /** Whether this file applies, `installed` telling which tools are there. */
  appliesWith(installed: (toolId: string) => boolean): boolean;
  /** Whether this file applies only because `toolId` is installed. */
  requires(toolId: string): boolean;
  /** Whether this file is the one at `destination`. */
  writes(destination: string): boolean;
  outputPath(): string;
  /** The file holding `content`, merged the tool's way, at its own path unless `place` names one. */
  fileOf(content: string, place?: ConfigFilePlace): InstallationFile;
  /** The file's fixed content, loaded through `loadAsset` when it lives in an asset. */
  resolveStaticContent(loadAsset?: (fileName: string) => ConfigAsset): string | null;
}

/** A hooks file a tool writes, as an install asks it. */
export interface HooksFileAnswers {
  /** Whether the tool takes the framework config artifact named `configName` into this file. */
  consumes(configName: string): boolean;
  /** The file holding `content`, merged the tool's way, at its own path unless `place` names one. */
  fileOf(content: string, place?: ConfigFilePlace): InstallationFile;
}

/** One config file a tool ships bundled: its content and where it lands, declared together so a
 * name cannot exist without a destination. `delivery` says who writes it there: an install of the
 * tool (`install`), the plugins' runtime-module step (`runtime`), or the settings section that
 * reads this content and owns the path (`section`). */
export interface ShippedConfig {
  readonly name: string;
  readonly content: ConfigAsset;
  readonly destination: string;
  readonly delivery: "install" | "runtime" | "section";
}

/** One config file a tool writes. The list a tool answers is in the order they claim a config
 * artifact: the first that consumes it writes it. */
export type ConfigWrite =
  | { readonly kind: "mcp"; readonly capability: McpConfigAnswers }
  | { readonly kind: "hooks"; readonly capability: HooksFileAnswers }
  | { readonly kind: "settings"; readonly capability: SettingsFileAnswers };

/** A model and the effort it runs at, in the tool's own ids. */
export interface ModelChoice {
  readonly model: string;
  readonly effort: string;
}

/** The agent roles of one tier, and the model they run on. */
export interface RoleModels extends ModelChoice {
  readonly roles: readonly string[];
}

/** Which providers' models a tool's main session and agents run on, asked and never read. */
export interface AgentModelAnswers {
  /** The providers it runs, in the framework's order. */
  providers(): readonly string[];
  /** The provider, once the tool is known to run it; refused, naming the ones it runs, otherwise. */
  supportedProvider(provider: string): string;
  /** The main session's model at the provider; its effort only where its settings take one. */
  mainModel(provider: string): { readonly model: string; readonly effort?: string };
  /** The agent roles of each tier and their model at the provider, highest tier first. */
  roleModels(provider: string): readonly RoleModels[];
  /** The main session's settings file, read from the machine-wide directory where the tool names
   * no user settings file of its own, and the schema heading one aidd creates; null when the main
   * session's model stays the tool's choice. */
  mainSettings(): { readonly file: string; readonly schema?: string } | null;
  /** The keys and values the main session's settings take for the provider. */
  mainSettingsValues(provider: string): Readonly<Record<string, string>>;
}

/** An AI assistant, as an outside caller asks it. */
export interface AiToolProfile {
  readonly kind: "ai";
  readonly toolId: AiToolId;
  /** The `.<tool>.md` ending that marks a source file as written for this tool. */
  readonly toolSuffix: string;
  /** Where a built file lands, relative to the project root, ending in a slash. */
  readonly directory: string;
  /** Where its plugin manifest or marketplace catalog may sit inside a distribution it produced,
   * relative to the distribution root, none when it declares none. Order is irrelevant: the
   * collected probes are sorted deepest first. */
  distributionPaths(kind: "manifest" | "marketplace"): readonly string[];
  /** Flat when its plugins are injected into the project tree, a marketplace otherwise. */
  frameworkBuildMode(): FrameworkBuildMode;
  /** The framework-build contract for `mode`, or null when the tool declares none for it. With a
   * provider, every agent of a role the framework tiers runs on that tier's model there. */
  buildContract(mode: FrameworkBuildMode, provider?: string): ToolBuildContract | null;
  /** Where a flat plugin's file of `section` lands, relative to the project root. */
  flatInstallPath(section: FlatInstallSection, pluginName: string, fileName: string): string;
  /** Whether a built, project-relative path is one of `pluginName`'s files in this tool's tree.
   * Limit: a flat skill or agent is matched by the `<plugin>-` prefix, so a plugin whose name
   * prefixes a sibling's would claim its files; no framework plugin name does. */
  ownsFlatPath(relativePath: string, pluginName: string): boolean;
  /** How this tool writes the references of its documents. */
  readonly linkSyntax: LinkSyntax;
  /** The tool's plugin delivery, or null when it declares none. */
  plugins(): PluginAnswers | null;
  /** Whether `--scope user` has anywhere to point this tool: false when it declares no plugins. */
  supportsUserScopeActivation(): boolean;
  /** The commands, agents or rules section the tool declares, or null. */
  markdownSection(kind: "commands" | "agents" | "rules"): MarkdownSectionAnswers | null;
  /** Whether the tool declares a skills section. */
  declaresSkills(): boolean;
  /** The providers its main session and agents can run on, or null when it runs none. */
  agentModels(): AgentModelAnswers | null;
  /** The config files an install writes, by asset name: the tool's own, then the runtime
   * modules its plugins need. */
  configFiles(): Readonly<Record<string, string>>;
  /** The runtime modules its plugins need, by asset name. */
  runtimeFiles(): Readonly<Record<string, string>>;
  /** The one shipped config of that name, or undefined when the tool ships none by it. */
  configAsset(name: string): ShippedConfig | undefined;
  /** The mcp file the tool declares, or null. */
  mcpConfig(): McpConfigAnswers | null;
  /** The mcp file of a tool that merges plugin MCP entries into one shared file it owns the
   * framework half of, or null when the tool is not one. */
  flatPluginMcp(): McpConfigAnswers | null;
  /** The settings files the tool declares, none when it declares none. */
  settingsFiles(): readonly SettingsFileAnswers[];
  /** The config files an install writes: mcp, then hooks, then each settings file. */
  configWrites(): readonly ConfigWrite[];
  /** The files this tool keeps machine-local that an install must ignore and `status` must skip;
   * none when it keeps none. */
  machineLocalFiles(): readonly string[];
  /** Where it takes a plugin's hooks inside the project, or null when it takes none there. */
  projectHooksDelivery(): ProjectHooksLocation | null;
  /** Where its installed rules live and what they end in, or null when it installs none. */
  installedRulesLocation(): { readonly directory: string; readonly extension: string } | null;
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
  /** The one shipped config of that name, or undefined when the tool ships none by it. */
  configAsset(name: string): ShippedConfig | undefined;
  /** The config files an install writes: each settings file. */
  configWrites(): readonly ConfigWrite[];
  /** Where its own commands sit in the project at `projectRoot`, or null when it declares none. */
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
  /** The files this tool keeps machine-local that an install must ignore and `status` must skip;
   * none when it keeps none. */
  machineLocalFiles(): readonly string[];
}

export type ToolProfile = AiToolProfile | IdeToolProfile;
