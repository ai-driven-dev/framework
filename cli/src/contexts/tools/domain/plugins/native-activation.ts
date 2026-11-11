import { CapabilityConfigError } from "../../../../kernel/errors.js";

/** One variable, as the caller reads it: a profile is a declaration and reaches no global. */
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

/** Where a host's registry lives, given a homedir, and the layout its file is read as. */
export interface HostRegistryDeclaration<Layout extends string> {
  readonly location: (homedir: string) => string;
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
   * Claude's *local* scope — the registration names an absolute path, wrong for everyone
   * else in the shared project settings. Omit where the registry has no scopes. */
  scopeArgs?: Readonly<Record<"project" | "user", readonly string[]>>;
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
  /** This tool's own marketplace registry: where it lives given a homedir, and the layout
   * it is read as. Declared for Claude alone, which derives a registration's name
   * from the source's own catalog and silently repoints a same-named entry from a different
   * source; its absence is what keeps the guard reading it claude-only. */
  marketplaceRegistry?: HostRegistryDeclaration<MarketplaceRegistryLayout>;
  /** Where a marketplace's current source is read from before a native mutation. Omit and no
   * source witness exists for this tool. `from: "marketplace-registry"` requires
   * `marketplaceRegistry`. */
  marketplaceSources?: MarketplaceSourcesDeclaration;
  /** Root of this tool's own plugin cache, given a homedir. Declared only where the host's
   * own CLI leaves something behind after `clean` drove its uninstall and remove: claude
   * keeps the whole built tree, marked `.orphaned_at`; codex the empty `cache/<hostName>/`
   * shell. `clean` reads this declaration alone and invents no path for a tool that omits
   * it, and never removes without `realpath` containment against this root. */
  pluginCacheDir?: (homedir: string) => string;
  /** This tool's own user-scope settings file, never written by aidd and read by a
   * diagnostic alone. Declared only for a tool that also declares `NativeActivation`. */
  userSettingsPath?: (homedir: string, env: EnvironmentReader) => string;
}

export class NativeActivation implements NativeActivationSpec {
  readonly binary: NativeActivationSpec["binary"];
  readonly pluginRegistry?: NativeActivationSpec["pluginRegistry"];
  readonly marketplaceSources?: NativeActivationSpec["marketplaceSources"];
  readonly enableVerb: NativeActivationSpec["enableVerb"];
  readonly disableVerb: NativeActivationSpec["disableVerb"];
  readonly scopeArgs?: NativeActivationSpec["scopeArgs"];
  readonly userRemoveArgs?: NativeActivationSpec["userRemoveArgs"];
  readonly uninstallLeavesRefDisabled?: NativeActivationSpec["uninstallLeavesRefDisabled"];
  readonly forceRemoveArgs?: NativeActivationSpec["forceRemoveArgs"];
  readonly sourceCheckVerb?: NativeActivationSpec["sourceCheckVerb"];
  readonly upgradeVerb?: NativeActivationSpec["upgradeVerb"];
  readonly updateVerb?: NativeActivationSpec["updateVerb"];
  readonly pluginArgs?: NativeActivationSpec["pluginArgs"];
  readonly marketplaceRegistry?: NativeActivationSpec["marketplaceRegistry"];
  readonly pluginCacheDir?: NativeActivationSpec["pluginCacheDir"];
  readonly userSettingsPath?: NativeActivationSpec["userSettingsPath"];

  constructor(spec: NativeActivationSpec) {
    if (spec.binary === "")
      throw new CapabilityConfigError("A native activation declares an empty binary");
    if (spec.marketplaceSources?.from === "marketplace-registry" && !spec.marketplaceRegistry)
      throw new CapabilityConfigError(
        "A native activation reads its marketplace sources from a registry it does not declare"
      );
    this.binary = spec.binary;
    this.pluginRegistry = spec.pluginRegistry;
    this.marketplaceSources = spec.marketplaceSources;
    this.enableVerb = spec.enableVerb;
    this.disableVerb = spec.disableVerb;
    this.scopeArgs = spec.scopeArgs;
    this.userRemoveArgs = spec.userRemoveArgs;
    this.uninstallLeavesRefDisabled = spec.uninstallLeavesRefDisabled;
    this.forceRemoveArgs = spec.forceRemoveArgs;
    this.sourceCheckVerb = spec.sourceCheckVerb;
    this.upgradeVerb = spec.upgradeVerb;
    this.updateVerb = spec.updateVerb;
    this.pluginArgs = spec.pluginArgs;
    this.marketplaceRegistry = spec.marketplaceRegistry;
    this.pluginCacheDir = spec.pluginCacheDir;
    this.userSettingsPath = spec.userSettingsPath;
  }

  /** Whether a plugin ref stays in use. A host that keeps an uninstalled ref, disabled, makes a
   * disabled ref indistinguishable from one the person disabled, so only an enabled one counts. */
  takesRefForInUse(enabled: boolean): boolean {
    return enabled || this.uninstallLeavesRefDisabled !== true;
  }
}
