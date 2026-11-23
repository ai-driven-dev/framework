import type { Scope } from "../../../shared/domain/scope.js";
import type { MarketplaceSettingsInput } from "./tool-vocabulary.js";

/** A path under the home directory, declared as data: a template, or a directory an environment
 * variable names, with a template to fall back on, and the file name under it. */
export type HomePath =
  | HomeTemplate
  | { readonly env: string; readonly fallback: HomeTemplate; readonly fileName: string };

/** A `/`-separated path whose `{home}` segment stands for the home directory. */
export type HomeTemplate = string;

/** Reads one environment variable, undefined when it is unset. */
export type EnvironmentReader = (name: string) => string | undefined;

/** How a host's own plugin registry is laid out. The names describe the file's shape, never
 * the tool that keeps it, so a second host with the same shape declares the same layout. */
export type PluginRegistryLayout =
  | "plugin-entries-by-scope"
  | "toml-plugin-tables"
  | "enabled-plugins-map";

/** How a host's own marketplace registry is laid out. */
export type MarketplaceRegistryLayout = "install-locations-by-name";

/** How a host's marketplace list answers when asked for JSON. */
export type MarketplaceListLayout = "marketplaces-with-source" | "name-source-rows";

/** Where a host's registry lives under the home directory, and the layout its file is read as. */
export interface HostRegistryDeclaration<Layout extends string> {
  readonly location: HomeTemplate;
  readonly layout: Layout;
}

/** Where a native marketplace's current source is read from: the host's own registry, or its
 * structured list command, whose words the declaration carries. */
export type MarketplaceSourcesDeclaration =
  | { readonly from: "marketplace-registry" }
  | {
      readonly from: "list-command";
      readonly args: readonly string[];
      readonly layout: MarketplaceListLayout;
      /** How the host is named in what a parse refuses. */
      readonly hostLabel: string;
      readonly unavailableMessage: string;
      readonly unverifiedMessage: string;
    };

/**
 * A tool that writes its own marketplace registration, through its own CLI: driving the
 * command is preferred to writing the file, so the tool owns its own configuration.
 * `binary` keys the matching `HostActions`.
 */
export interface NativeActivationSpec {
  /** Names the host's executable and keys the matching `HostActions`. Refused when empty. */
  binary: string;
  /** One mapping serves add and remove: a remove omitting the scope the add used drops
   * Claude's declaration from every scope at once. A project-scoped marketplace maps to
   * Claude's *local* scope: the registration names an absolute path, wrong for everyone
   * else in the shared project settings. Omit where the registry has no scopes. */
  scopeArgs?: Readonly<Record<Scope, readonly string[]>>;
  /** Scope arguments `plugin marketplace remove` takes at user scope instead of
   * `scopeArgs.user` when no project uses the marketplace, run from the home directory.
   * Measured on Claude 2.1.318: `remove --scope user` drops the settings declaration and keeps
   * the registration and a project's install; a remove naming no scope deletes the registration
   * and uninstalls that project's plugins too, with their saved options. */
  userRemoveArgs?: readonly string[];
  /** The host keeps an uninstalled plugin's ref, disabled, so a disabled ref cannot be told
   * from one the person disabled and is not taken for a plugin in use. */
  uninstallLeavesRefDisabled?: boolean;
  /** Arguments that make `plugin marketplace remove` succeed with plugins installed from it.
   * Permits reclaiming a name, so declare it only alongside `sourceCheckVerb`. */
  forceRemoveArgs?: readonly string[];
  /** Verb after `plugin marketplace` whose exit code separates a registration whose source
   * is gone from one that resolves. Measured: copilot's `update` discriminates, while
   * codex's `upgrade` refuses every local marketplace and Claude's reports success on a
   * path that does not exist. */
  sourceCheckVerb?: string;
  /** Verb this CLI uses to re-index its marketplaces, after `plugin marketplace`. Omit when
   * plugins are not enabled through the CLI. */
  upgradeVerb?: string;
  /** Exact host command for updating one installed plugin ref. Copilot declares `update`; Codex does not. */
  updateVerb?: string;
  /** Verb this CLI uses to enable a plugin, after `plugin`. */
  enableVerb: string;
  /** How the tool spells removing a plugin it installed: `remove` for codex, `uninstall` for
   * claude and copilot. */
  disableVerb: string;
  /** Arguments every `plugin <verb> <ref>` call carries, after the reference. Claude needs
   * `--yes` on install and uninstall alike: a headless stdin can answer no prompt. */
  pluginArgs?: readonly string[];
  /** This tool's own plugin registry: the file it keeps and the layout it is read as. Read by
   * `doctor` to compare what the host loads with what a manifest claims. Omit for a tool whose
   * registry was never measured; it is then reported unanswerable rather than assumed to agree. */
  pluginRegistry?: HostRegistryDeclaration<PluginRegistryLayout>;
  /** This tool's own marketplace registry: where it lives under the home directory, and the layout
   * it is read as. Declared for Claude alone, which derives a registration's name
   * from the source's own catalog and silently repoints a same-named entry from a different
   * source; its absence is what keeps the guard reading it claude-only. */
  marketplaceRegistry?: HostRegistryDeclaration<MarketplaceRegistryLayout>;
  /** Where a marketplace's current source is read from before a native mutation. Omit and no
   * source witness exists for this tool. `from: "marketplace-registry"` requires
   * `marketplaceRegistry`. */
  marketplaceSources?: MarketplaceSourcesDeclaration;
  /** Root of this tool's own plugin cache, under the home directory. Declared only where the host's
   * own CLI leaves something behind after `clean` drove its uninstall and remove: claude
   * keeps the whole built tree, marked `.orphaned_at`; codex the empty `cache/<hostName>/`
   * shell. `clean` reads this declaration alone and invents no path for a tool that omits
   * it, and never removes without `realpath` containment against this root. */
  pluginCacheDir?: HomeTemplate;
  /** This tool's own user-scope settings file, never written by aidd and read by a
   * diagnostic alone. Declared only for a tool that also declares `NativeActivation`. */
  userSettingsPath?: HomePath;
}

/** Where and how a tool records the marketplaces it knows about, for the tools whose settings
 * file this CLI writes itself. Kept apart from the plugin layout because the two answer
 * different questions: this one is read only by marketplace settings synchronisation. */
export interface MarketplaceSettings {
  settingsPath: string;
  settingsKey: string;
  enabledPluginsKey?: string;
  /** A true entry installs the plugin when the host next loads this repository. Only project
   * native refs proven during this run may be projected into this file. */
  declarativePluginActivationRequiresNativeProof?: boolean;
  /**
   * Where the tool keeps its registered marketplaces, for `doctor`, which checks the tool
   * actually wrote one. A path names a file of its own, which this CLI neither commits nor
   * hashes since its entries name built trees by absolute path; `null` means nowhere: the tool
   * offers no machine-local project file, and its shared one is for recommending plugins to
   * teammates, where a path belonging to whoever ran the install is worse than nothing.
   */
  marketplacesSettingsPath: string | null;
  /** The name this marketplace is keyed by in the enabled-plugins map, or `null` when the tool
   * cannot express its source and no key should be written. */
  toEntryKey(input: MarketplaceSettingsInput): string | null;
}
