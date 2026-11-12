import { DuplicateToolIdError, UnregisteredToolError } from "../../../kernel/errors.js";
import type { AiToolId, ToolCategory, ToolId } from "../../../kernel/tool.js";
import type { ToolBuildContract } from "../contract/build-contract.js";
import type { EnvironmentReader, FrameworkBuildMode } from "../contract/tool-profile.js";
import type { GlobalFiles, HookScript, ProjectHooksFormat } from "../contract/tool-vocabulary.js";
import type { McpCapability } from "./capabilities/mcp-capability.js";
import type { SettingsCapability } from "./capabilities/settings-capability.js";
import type { AiTool, IdeToolConfig } from "./contracts.js";
import type { NativeActivation } from "./plugins/native-activation.js";
import type { NativePluginsCapability, PluginsCapability } from "./plugins/plugins-capability.js";
import type { ProfileBrand } from "./profile/define-tool.js";
import { REGISTERED_PROFILES } from "./profiles/registered-profiles.js";

export type ToolConfig = AiTool | IdeToolConfig;

/** A profile only the factory could have produced. */
export type BuiltToolConfig = ToolConfig & ProfileBrand;

export function isAiTool(config: ToolConfig): config is AiTool {
  return config.kind === "ai";
}

export class ToolCatalog {
  private readonly byId = new Map<ToolId, BuiltToolConfig>();

  constructor(profiles: readonly BuiltToolConfig[]) {
    for (const profile of profiles) {
      if (this.byId.has(profile.toolId)) throw new DuplicateToolIdError(profile.toolId);
      this.byId.set(profile.toolId, profile);
    }
  }

  replacing(profile: BuiltToolConfig): ToolCatalog {
    this.getToolConfig(profile.toolId);
    return new ToolCatalog(
      [...this.byId.values()].map((existing) =>
        existing.toolId === profile.toolId ? profile : existing
      )
    );
  }

  getToolConfig(toolId: ToolId): BuiltToolConfig {
    const config = this.byId.get(toolId);
    if (!config) throw new UnregisteredToolError(toolId);
    return config;
  }

  getAiToolConfig(toolId: AiToolId): AiTool {
    const config = this.getToolConfig(toolId);
    if (!isAiTool(config)) throw new UnregisteredToolError(toolId);
    return config;
  }

  getAllRegisteredTools(): Map<ToolId, ToolConfig> {
    return new Map(this.byId);
  }

  nativeActivationOf(toolId: ToolId): NativeActivation | undefined {
    const config = this.getToolConfig(toolId);
    return isAiTool(config) ? config.nativeActivation() : undefined;
  }

  frameworkBuildModeFor(toolId: ToolId): FrameworkBuildMode {
    return this.resolvePluginsCapability(toolId)?.kind === "flat" ? "flat" : "marketplace";
  }

  pluginEnablementIsMachineGlobal(toolId: ToolId): boolean {
    return this.resolveNativePlugins(toolId)?.enablementIsMachineGlobal() ?? true;
  }

  supportsUserScopeActivation(toolId: ToolId): boolean {
    const config = this.getToolConfig(toolId);
    return isAiTool(config) && config.supportsUserScopeActivation();
  }

  hostRefInUse(toolId: ToolId, enabled: boolean): boolean {
    const config = this.getToolConfig(toolId);
    return isAiTool(config) ? config.hostRefInUse(enabled) : true;
  }

  copiesPluginFilesGlobally(toolId: ToolId): boolean {
    return this.resolvePluginsCapability(toolId)?.copiesFilesGlobally() ?? false;
  }

  globalFilesOf(toolId: ToolId): GlobalFiles | null {
    return this.resolvePluginsCapability(toolId)?.globalFiles() ?? null;
  }

  buildContractFor(
    toolId: ToolId,
    mode: FrameworkBuildMode
  ): (() => ToolBuildContract) | undefined {
    const config = this.getToolConfig(toolId);
    if (!isAiTool(config)) return undefined;
    return config.buildContracts[mode];
  }

  userMachineLocalFilesOf(
    toolId: ToolId,
    homedir: string,
    env: EnvironmentReader
  ): readonly string[] {
    const path = this.nativeActivationOf(toolId)?.userSettingsFile(homedir, env);
    return path === undefined ? [] : [path];
  }

  machineLocalFilesOf(toolId: ToolId): readonly string[] {
    return this.resolveNativePlugins(toolId)?.marketplaceRegistration()?.machineLocalFiles() ?? [];
  }

  projectHooksFileOf(toolId: ToolId): string | undefined {
    return this.resolvePluginsCapability(toolId)?.projectHooksDelivery()?.relativePath;
  }

  projectHooksDeliveryOf(toolId: ToolId): {
    relativePath: string;
    format: ProjectHooksFormat;
    toolName: string;
    hookScript: HookScript;
  } | null {
    const config = this.getToolConfig(toolId);
    if (!isAiTool(config)) return null;
    const delivery = this.resolvePluginsCapability(toolId)?.projectHooksDelivery();
    if (delivery === null || delivery === undefined) return null;
    return { ...delivery, toolName: config.displayName };
  }

  mcpCapabilityOf(toolId: ToolId): McpCapability | null {
    const config = this.getToolConfig(toolId);
    if (!isAiTool(config)) return null;
    return config.section("mcp");
  }

  settingsCapabilitiesOf(toolId: AiToolId): readonly SettingsCapability[] {
    return this.getAiToolConfig(toolId).section("settings") ?? [];
  }

  resolvePluginsCapability(toolId: ToolId): PluginsCapability | null {
    const toolConfig = this.getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return null;
    return toolConfig.plugins();
  }

  resolveNativePlugins(toolId: ToolId): NativePluginsCapability | null {
    const plugins = this.resolvePluginsCapability(toolId);
    return plugins?.kind === "native" ? plugins : null;
  }
}

const catalog = new ToolCatalog(REGISTERED_PROFILES);

export function getToolConfig(toolId: ToolId): BuiltToolConfig {
  return catalog.getToolConfig(toolId);
}

export function getAiToolConfig(toolId: AiToolId): AiTool {
  return catalog.getAiToolConfig(toolId);
}

/** Every registered tool, sorted by id: the order the setup and doctor flows walk them,
 * whatever order the registration list keeps for its help texts. */
export function getAllRegisteredTools(): Map<ToolId, ToolConfig> {
  return new Map(
    [...catalog.getAllRegisteredTools()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/** The ids of one category, in registration order: the order a help text names the tools. */
export function registeredToolIds(category: ToolCategory): readonly ToolId[] {
  return [...catalog.getAllRegisteredTools().values()]
    .filter((config) => config.kind === category)
    .map((config) => config.toolId);
}

/** The tool's native plugin CLI declaration, or undefined when it has none. Read from the
 * profile so the set of driven tools is data, not a hand-kept list. */
export function nativeActivationOf(toolId: ToolId): NativeActivation | undefined {
  return catalog.nativeActivationOf(toolId);
}

/** Flat when the tool's plugins capability is flat, a marketplace otherwise. Read from the
 * profile rather than branched on the tool's name, so a sixth flat tool needs no edit outside
 * its own profile. */
export function frameworkBuildModeFor(toolId: ToolId): FrameworkBuildMode {
  return catalog.frameworkBuildModeFor(toolId);
}

/** Whether this tool enables a plugin for the whole machine rather than for one project: a
 * tool declaring no `NativeActivation.scopeArgs` (codex, copilot) has nothing to tell
 * `enablePlugin`/`uninstallPlugin` which scope to ask for, so its own CLI always acts
 * machine-wide. Also `true` for a tool with no native activation at all. */
export function pluginEnablementIsMachineGlobal(toolId: ToolId): boolean {
  return catalog.pluginEnablementIsMachineGlobal(toolId);
}

/** Whether `--scope user` has anywhere to point this tool: it drives its own CLI machine-wide,
 * installs a plugin's files into a user-scope directory, or copies global files into the
 * user's configuration directory. `false` for a tool declaring none. */
export function supportsUserScopeActivation(toolId: ToolId): boolean {
  return catalog.supportsUserScopeActivation(toolId);
}

/** Whether a ref the host's registry lists is a plugin in use: an enabled one always; a disabled
 * one unless the host's uninstall itself leaves refs disabled, where the two cannot be told
 * apart and the ref is taken for what an uninstall left behind. */
export function hostRefInUse(toolId: ToolId, enabled: boolean): boolean {
  return catalog.hostRefInUse(toolId, enabled);
}

/** Whether `setup --global` writes a plugin's files itself for this tool, into its user plugins
 * directory or its user configuration directory, instead of only enabling the plugin through
 * the tool's own CLI. */
export function copiesPluginFilesGlobally(toolId: ToolId): boolean {
  return catalog.copiesPluginFilesGlobally(toolId);
}

/** See {@link GlobalFiles}: `null` for a tool whose machine-scope install copies no file. */
export function globalFilesOf(toolId: ToolId): GlobalFiles | null {
  return catalog.globalFilesOf(toolId);
}

/** The tool's declared build contract for one framework-build mode, or undefined when the tool
 * does not support that mode. Read from the profile, so the build registry is derived by
 * iterating the registered tools instead of listing every tool/mode pair by hand. */
export function buildContractFor(
  toolId: ToolId,
  mode: FrameworkBuildMode
): (() => ToolBuildContract) | undefined {
  return catalog.buildContractFor(toolId, mode);
}

/** A tool's own user-scope settings file, absolute under `homedir` — never written by aidd,
 * only named by a diagnostic. Empty for a tool whose profile declares no
 * `NativeActivation.userSettingsPath`. */
export function userMachineLocalFilesOf(
  toolId: ToolId,
  homedir: string,
  env: EnvironmentReader
): readonly string[] {
  return catalog.userMachineLocalFilesOf(toolId, homedir, env);
}

/**
 * Files this CLI writes for a tool and deliberately does not track.
 *
 * Their content names absolute paths, so they describe one machine: committing them would hand
 * a teammate a pointer that cannot resolve, and hashing them would make every other machine
 * read as drift.
 */
export function machineLocalFilesOf(toolId: ToolId): readonly string[] {
  return catalog.machineLocalFilesOf(toolId);
}

/**
 * The project's own hooks file a plugin's hooks are merged into, for a tool declaring
 * `hooksDestination: "project"`, or `undefined` for a tool with nothing merged there.
 *
 * Deliberately not folded into `machineLocalFilesOf`: every path this file names is
 * project-relative and shareable, and `aiddGitignoreEntries` reads that function — folding
 * this in would gitignore a file that belongs in the repo.
 */
export function projectHooksFileOf(toolId: ToolId): string | undefined {
  return catalog.projectHooksFileOf(toolId);
}

/** The project hooks file a tool merges plugin hooks into, or `null` when it has none. */
export function projectHooksDeliveryOf(toolId: ToolId): {
  relativePath: string;
  format: ProjectHooksFormat;
  toolName: string;
  hookScript: HookScript;
} | null {
  return catalog.projectHooksDeliveryOf(toolId);
}

/** The tool's MCP capability, or `null` when it declares none or is not an AI tool. */
export function mcpCapabilityOf(toolId: ToolId): McpCapability | null {
  return catalog.mcpCapabilityOf(toolId);
}

/** A tool's plugin capability, or `null` when it declares none. Here rather than beside one of
 * its callers: it reads nothing but this registry, and its callers span three of them. */
export function resolvePluginsCapability(toolId: ToolId): PluginsCapability | null {
  return catalog.resolvePluginsCapability(toolId);
}
