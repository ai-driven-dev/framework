import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type {
  FlatHooksBridge,
  FlatSkillLayout,
  GlobalFiles,
  HookScript,
  ProjectHooksDelivery,
  ProjectHooksFormat,
} from "../capabilities/plugins-capability.js";
import type { MarketplaceRegistration } from "./marketplace-registration.js";
import type { NativeActivation } from "./native-activation.js";

/** Where a flat-mode plugin lands and how its hooks are loaded; each part is `null` or
 * `"nested"` when the mode has none. */
export interface FlatLayout {
  skillLayout: FlatSkillLayout;
  namespacePrefix: string | null;
  hooksDir: string | null;
  hooksLoaderEntry: FlatHooksLoaderEntry | null;
  hooksBridge: FlatHooksBridge | null;
}

/** Where a hook lands in the project and how, with the script as this tool runs it. */
export interface ProjectHooksPlacement {
  relativePath: string;
  format: ProjectHooksFormat;
  hookScript: HookScript;
}

const NESTED_LAYOUT: FlatLayout = {
  skillLayout: "nested",
  namespacePrefix: null,
  hooksDir: null,
  hooksLoaderEntry: null,
  hooksBridge: null,
};

export const AS_SHIPPED: HookScript = (_pluginPath, content) => content;

const DEFAULT_MCP_PATH = ".mcp.json";
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

/**
 * What a tool answers about how a plugin is delivered to it. One variant per way a tool takes
 * plugins (native, flat, unsupported), each holding only the data that way needs; callers ask
 * and never read a field.
 */
export interface PluginDelivery {
  /** Whether this tool is built as a marketplace dist or a flat workspace inject. */
  buildMode(): "marketplace" | "flat";
  /** Whether the tool declares a marketplace dist as its translation, as a neutral native does not. */
  translatesAsMarketplace(): boolean;
  isNative(): boolean;
  requiresUserScope(): boolean;
  deliversHooksToProject(): boolean;
  projectPluginsDir(): string | null;
  manifestPath(): string | null;
  rootToken(): string | null;
  /** Whether a delivered hook runs on this tool, and why not when it does not. */
  hooksAcceptance(): { accepts: boolean; unsupportedReason: string | null };
  trustNotice(): string | null;
  flatLayout(): FlatLayout;
  activation(): NativeActivation | null;
  marketplaceRegistration(): MarketplaceRegistration | null;
  /** Whether enabling a plugin applies to the whole machine, the host taking no scope. */
  enablementIsMachineGlobal(): boolean;
  supportsUserScopeActivation(): boolean;
  copiesFilesGlobally(): boolean;
  /** See {@link GlobalFiles}, or `null` when a machine-scope install copies no file. */
  globalFiles(): GlobalFiles | null;
  /** Where a hook lands in the project and how, or `null` when it lands in the plugin. */
  projectHooksDelivery(): ProjectHooksPlacement | null;
  /** Whether the tool takes a plugin's MCP file, and where it lands in the plugin directory. */
  mcpFile(): { accepts: boolean; relativePath: string };
  /** Where the plugin's hooks manifest lands in the plugin directory. */
  hooksFilePath(): string;
  /** A delivered hook script as this tool runs it: the tool's host adapter in place of the one
   * the plugin ships, every other script as shipped. */
  hookScript(pluginPath: string, content: string): string;
  pluginOutputDir(pluginName: string): string | null;
  resolvePluginsBaseDir(projectRoot: string, homedir: string): string;
  /** The absolute user-scope plugins directory this tool declares, or `null`. Read
   * independently of the tool's own scope: a caller resolving a *recorded* scope still needs
   * the directory that scope means. */
  userPluginsBaseDir(homedir: string): string | null;
}

/** The answers a tool gives when it does nothing special; each variant overrides what it does. */
export abstract class PluginDeliveryBase implements PluginDelivery {
  constructor(private readonly machineFiles: GlobalFiles | null) {}

  abstract hooksAcceptance(): { accepts: boolean; unsupportedReason: string | null };

  buildMode(): "marketplace" | "flat" {
    return "marketplace";
  }
  translatesAsMarketplace(): boolean {
    return false;
  }
  isNative(): boolean {
    return false;
  }
  requiresUserScope(): boolean {
    return false;
  }
  deliversHooksToProject(): boolean {
    return this.projectHooksDelivery() !== null;
  }
  projectPluginsDir(): string | null {
    return null;
  }
  manifestPath(): string | null {
    return null;
  }
  rootToken(): string | null {
    return null;
  }
  trustNotice(): string | null {
    return null;
  }
  flatLayout(): FlatLayout {
    return NESTED_LAYOUT;
  }
  activation(): NativeActivation | null {
    return null;
  }
  marketplaceRegistration(): MarketplaceRegistration | null {
    return null;
  }
  enablementIsMachineGlobal(): boolean {
    return this.activation()?.scopeArgs === undefined;
  }
  supportsUserScopeActivation(): boolean {
    return this.activation() !== null || this.requiresUserScope() || this.machineFiles !== null;
  }
  copiesFilesGlobally(): boolean {
    return this.requiresUserScope() || this.machineFiles !== null;
  }
  globalFiles(): GlobalFiles | null {
    return this.machineFiles;
  }
  projectHooksDelivery(): ProjectHooksPlacement | null {
    return null;
  }
  mcpFile(): { accepts: boolean; relativePath: string } {
    return { accepts: false, relativePath: DEFAULT_MCP_PATH };
  }
  hooksFilePath(): string {
    return DEFAULT_HOOKS_PATH;
  }
  hookScript(_pluginPath: string, content: string): string {
    return content;
  }
  pluginOutputDir(_pluginName: string): string | null {
    return null;
  }
  resolvePluginsBaseDir(projectRoot: string, _homedir: string): string {
    return projectRoot;
  }
  userPluginsBaseDir(homedir: string): string | null {
    return this.machineFiles?.dir(homedir) ?? null;
  }
}

/**
 * The project hooks file this tool delivers to, or `null` when a hook lands in the plugin's own
 * directory. A project destination without its file path and format is refused here.
 */
export function resolveProjectHooks(
  delivery: ProjectHooksDelivery,
  hookScript: HookScript
): ProjectHooksPlacement | null {
  if (delivery.hooksDestination !== "project") {
    if (delivery.projectHooksFormat !== undefined) {
      throw new CapabilityConfigError("projectHooksFormat requires hooksDestination 'project'.");
    }
    return null;
  }
  if (delivery.projectHooksRelativePath === undefined) {
    throw new CapabilityConfigError(
      "hooksDestination 'project' requires a projectHooksRelativePath."
    );
  }
  if (delivery.projectHooksFormat === undefined) {
    throw new CapabilityConfigError("hooksDestination 'project' requires a projectHooksFormat.");
  }
  return {
    relativePath: delivery.projectHooksRelativePath,
    format: delivery.projectHooksFormat,
    hookScript,
  };
}
