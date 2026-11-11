import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type { MarketplaceSettings } from "../marketplace-settings.js";
import type { PluginTranslationMode } from "../plugin-translation-mode.js";
import { MarketplaceRegistration } from "../plugins/marketplace-registration.js";
import { NativeActivation, type NativeActivationSpec } from "../plugins/native-activation.js";

export type PluginsMode = "native" | "flat" | "unsupported";

/** A hook script as the tool runs it, given its path in the plugin and its shipped content. */
export type HookScript = (pluginPath: string, content: string) => string;

const AS_SHIPPED: HookScript = (_pluginPath, content) => content;

const DEFAULT_MCP_PATH = ".mcp.json";
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

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
   * hook or MCP command. Absent means nothing is substituted. */
  pluginRootToken?: string;
  /** See {@link PluginsCapability.hookScript}. */
  hookScript?: HookScript;
  marketplaceSettings?: MarketplaceSettings;
  /** Enables native CLI-driven plugin activation. See {@link NativeActivation}. */
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
      /** See {@link PluginsCapability.hookScript}. */
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

type PluginsParams = (
  | (NativePluginsParams & HooksSupport)
  | FlatPluginsParams
  | UnsupportedPluginsParams
) &
  GlobalFilesParams;

export class PluginsCapability {
  readonly mode: PluginsMode;
  readonly pluginsDir: string | null;
  readonly pluginManifestRelativePath: string | null;
  readonly flatNamespacePrefix: string | null;
  readonly acceptsHooks: boolean;
  /** Why no hook is delivered, or `null` when they are. */
  readonly hooksUnsupportedReason: string | null;
  /** What still has to happen before a delivered hook actually runs, or `null` when nothing
   * does. See {@link HooksSupport}. */
  readonly hooksTrustNotice: string | null;
  readonly pluginRootToken: string | null;
  readonly acceptsMcp: boolean;
  readonly mcpRelativePath: string;
  readonly hooksRelativePath: string;
  readonly hooksDestination: "plugin" | "project";
  /** Relative to the project root, or `null` when `hooksDestination` is `"plugin"`. */
  readonly projectHooksRelativePath: string | null;
  readonly projectHooksFormat: ProjectHooksFormat | null;
  /** Where a flat-mode hook lands, relative to the project root, or `null` when this
   * capability accepts no hooks. */
  readonly flatHooksDir: string | null;
  /** See {@link FlatHooksSupport.flatHooksLoaderEntry}. */
  readonly flatHooksLoaderEntry: FlatHooksLoaderEntry | null;
  /** See {@link FlatHooksBridge}, or `null` when this capability declares none. */
  readonly flatHooksBridge: FlatHooksBridge | null;
  readonly flatSkillLayout: FlatSkillLayout;
  /** A delivered hook script as this tool runs it: the tool's host adapter in place of the one
   * the plugin ships, every other script as shipped. */
  readonly hookScript: HookScript;
  readonly marketplaceSettings: MarketplaceRegistration | null;
  readonly nativeActivation: NativeActivation | null;
  readonly translationMode: PluginTranslationMode | null;
  readonly installScope: "project" | "user";
  /** See {@link GlobalFiles}, or `null` when a machine-scope install copies no file. */
  readonly globalFiles: GlobalFiles | null;

  private readonly _userPluginsDir?: (homedir: string) => string;

  constructor(params: PluginsParams) {
    this.mode = params.mode;
    this.globalFiles = params.globalFiles ?? null;
    this.translationMode = PluginsCapability.resolveTranslationMode(params);
    this.installScope = PluginsCapability.resolveInstallScope(params);
    PluginsCapability.validateUserScope(params);
    PluginsCapability.validateProjectHooks(params);
    PluginsCapability.validateRootToken(params);
    if (params.mode === "native") {
      this.pluginsDir = params.pluginsDir;
      this.pluginManifestRelativePath = params.pluginManifestRelativePath;
      this.flatNamespacePrefix = null;
      this.acceptsHooks = params.acceptsHooks;
      this.hooksUnsupportedReason = params.acceptsHooks ? null : params.hooksUnsupportedReason;
      this.hooksTrustNotice = params.acceptsHooks ? (params.hooksTrustNotice ?? null) : null;
      this.pluginRootToken = params.pluginRootToken ?? null;
      this.acceptsMcp = params.acceptsMcp ?? false;
      this.mcpRelativePath = params.mcpRelativePath ?? DEFAULT_MCP_PATH;
      this.hooksRelativePath = params.hooksRelativePath ?? DEFAULT_HOOKS_PATH;
      this.hooksDestination = params.hooksDestination ?? "plugin";
      this.projectHooksRelativePath = params.projectHooksRelativePath ?? null;
      this.projectHooksFormat = params.projectHooksFormat ?? null;
      this.flatHooksDir = null;
      this.flatHooksLoaderEntry = null;
      this.flatHooksBridge = null;
      this.flatSkillLayout = "nested";
      this.hookScript = params.hookScript ?? AS_SHIPPED;
      this.nativeActivation =
        params.nativeActivation === undefined
          ? null
          : new NativeActivation(params.nativeActivation);
      this.marketplaceSettings =
        params.marketplaceSettings === undefined
          ? null
          : new MarketplaceRegistration(params.marketplaceSettings, this.nativeActivation);
      this._userPluginsDir = params.userPluginsDir;
    } else if (params.mode === "flat") {
      this.pluginsDir = null;
      this.pluginManifestRelativePath = null;
      this.flatNamespacePrefix = params.flatNamespacePrefix;
      this.acceptsHooks = params.acceptsHooks;
      this.hooksUnsupportedReason = params.acceptsHooks ? null : params.hooksUnsupportedReason;
      this.flatHooksDir = params.acceptsHooks ? params.flatHooksDir : null;
      this.flatHooksLoaderEntry = params.acceptsHooks
        ? (params.flatHooksLoaderEntry ?? null)
        : null;
      this.flatHooksBridge = params.acceptsHooks ? (params.flatHooksBridge ?? null) : null;
      this.flatSkillLayout = params.flatSkillLayout ?? "nested";
      this.hookScript = params.acceptsHooks ? (params.hookScript ?? AS_SHIPPED) : AS_SHIPPED;
      this.hooksTrustNotice = null;
      this.pluginRootToken = null;
      this.acceptsMcp = false;
      this.mcpRelativePath = DEFAULT_MCP_PATH;
      this.hooksRelativePath = DEFAULT_HOOKS_PATH;
      this.hooksDestination = params.acceptsHooks
        ? (params.hooksDestination ?? "plugin")
        : "plugin";
      this.projectHooksRelativePath = params.acceptsHooks
        ? (params.projectHooksRelativePath ?? null)
        : null;
      this.projectHooksFormat = params.acceptsHooks ? (params.projectHooksFormat ?? null) : null;
      this.marketplaceSettings = null;
      this.nativeActivation = null;
      this._userPluginsDir = undefined;
    } else {
      this.pluginsDir = null;
      this.pluginManifestRelativePath = null;
      this.flatNamespacePrefix = null;
      this.acceptsHooks = false;
      this.hooksUnsupportedReason = params.hooksUnsupportedReason;
      this.flatHooksDir = null;
      this.flatHooksLoaderEntry = null;
      this.flatHooksBridge = null;
      this.flatSkillLayout = "nested";
      this.hookScript = AS_SHIPPED;
      this.hooksTrustNotice = null;
      this.pluginRootToken = null;
      this.acceptsMcp = false;
      this.mcpRelativePath = DEFAULT_MCP_PATH;
      this.hooksRelativePath = DEFAULT_HOOKS_PATH;
      this.hooksDestination = "plugin";
      this.projectHooksRelativePath = null;
      this.projectHooksFormat = null;
      this.marketplaceSettings = null;
      this.nativeActivation = null;
      this._userPluginsDir = undefined;
    }
  }

  resolvePluginsBaseDir(projectRoot: string, homedir: string): string {
    if (this.installScope === "user" && this._userPluginsDir !== undefined) {
      return this._userPluginsDir(homedir);
    }
    return projectRoot;
  }

  /** The absolute user-scope plugins directory this capability declares, or `null`. Read
   * independently of this capability's own `installScope`: a caller resolving a *recorded*
   * scope still needs the directory that scope means. */
  userPluginsBaseDir(homedir: string): string | null {
    return this._userPluginsDir?.(homedir) ?? this.globalFiles?.dir(homedir) ?? null;
  }

  /** Whether this tool is built as a marketplace dist or a flat workspace inject. */
  buildMode(): "marketplace" | "flat" {
    return this.mode === "flat" ? "flat" : "marketplace";
  }

  isNative(): boolean {
    return this.mode === "native";
  }

  requiresUserScope(): boolean {
    return this.installScope === "user";
  }

  deliversHooksToProject(): boolean {
    return this.hooksDestination === "project";
  }

  projectPluginsDir(): string | null {
    return this.pluginsDir;
  }

  manifestPath(): string | null {
    return this.pluginManifestRelativePath;
  }

  rootToken(): string | null {
    return this.pluginRootToken;
  }

  /** Whether a delivered hook runs on this tool, and why not when it does not. */
  hooksAcceptance(): { accepts: boolean; unsupportedReason: string | null } {
    return { accepts: this.acceptsHooks, unsupportedReason: this.hooksUnsupportedReason };
  }

  trustNotice(): string | null {
    return this.hooksTrustNotice;
  }

  /** Where a flat-mode plugin lands and how its hooks are loaded; each part is `null` or
   * `"nested"` when the mode has none. */
  flatLayout(): {
    skillLayout: FlatSkillLayout;
    namespacePrefix: string | null;
    hooksDir: string | null;
    hooksLoaderEntry: FlatHooksLoaderEntry | null;
    hooksBridge: FlatHooksBridge | null;
  } {
    return {
      skillLayout: this.flatSkillLayout,
      namespacePrefix: this.flatNamespacePrefix,
      hooksDir: this.flatHooksDir,
      hooksLoaderEntry: this.flatHooksLoaderEntry,
      hooksBridge: this.flatHooksBridge,
    };
  }

  activation(): NativeActivation | null {
    return this.nativeActivation;
  }

  marketplaceRegistration(): MarketplaceRegistration | null {
    return this.marketplaceSettings;
  }

  /** Whether enabling a plugin applies to the whole machine, the host taking no scope. */
  enablementIsMachineGlobal(): boolean {
    return this.nativeActivation?.scopeArgs === undefined;
  }

  supportsUserScopeActivation(): boolean {
    return (
      this.nativeActivation !== null || this.installScope === "user" || this.globalFiles !== null
    );
  }

  copiesFilesGlobally(): boolean {
    return this.installScope === "user" || this.globalFiles !== null;
  }

  /** See {@link GlobalFiles}, or `null` when a machine-scope install copies no file. */
  globalFilesOrNull(): GlobalFiles | null {
    return this.globalFiles;
  }

  /** Where a hook lands in the project and how, or `null` when it lands in the plugin. */
  projectHooksDelivery(): {
    relativePath: string;
    format: ProjectHooksFormat;
    hookScript: HookScript;
  } | null {
    if (this.hooksDestination !== "project") return null;
    if (this.projectHooksRelativePath === null || this.projectHooksFormat === null) return null;
    return {
      relativePath: this.projectHooksRelativePath,
      format: this.projectHooksFormat,
      hookScript: this.hookScript,
    };
  }

  pluginOutputDir(pluginName: string): string | null {
    if (this.mode !== "native" || this.pluginsDir === null) return null;
    return `${this.pluginsDir}${pluginName}/`;
  }

  private static resolveTranslationMode(params: PluginsParams): PluginTranslationMode | null {
    if (params.mode === "native") return params.translationMode ?? null;
    if (params.mode === "flat") return "flat";
    return null;
  }

  private static resolveInstallScope(params: PluginsParams): "project" | "user" {
    if (params.mode === "native") return params.installScope ?? "project";
    return "project";
  }

  private static validateUserScope(params: PluginsParams): void {
    if (params.mode !== "native") return;
    if (params.installScope === "user" && params.userPluginsDir === undefined) {
      throw new CapabilityConfigError(
        "installScope 'user' requires a userPluginsDir resolver function."
      );
    }
  }

  private static validateRootToken(params: PluginsParams): void {
    if (params.mode === "native" && params.pluginRootToken === undefined) {
      throw new CapabilityConfigError("native mode requires a pluginRootToken.");
    }
  }

  private static validateProjectHooks(params: PluginsParams): void {
    if (params.mode === "unsupported" || !params.acceptsHooks) return;
    if (params.hooksDestination !== "project") {
      if (params.projectHooksFormat !== undefined) {
        throw new CapabilityConfigError("projectHooksFormat requires hooksDestination 'project'.");
      }
      return;
    }
    if (params.projectHooksRelativePath === undefined) {
      throw new CapabilityConfigError(
        "hooksDestination 'project' requires a projectHooksRelativePath."
      );
    }
    if (params.projectHooksFormat === undefined) {
      throw new CapabilityConfigError("hooksDestination 'project' requires a projectHooksFormat.");
    }
  }
}
