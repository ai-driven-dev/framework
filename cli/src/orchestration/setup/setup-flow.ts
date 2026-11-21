import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import type { NativeActivationReport } from "../../contexts/installation/application/install/install-ai-tool.js";
import type { InstallToolsResult } from "../../contexts/installation/application/install/install-tools.js";
import type { ProjectContext } from "../../contexts/installation/contract/project-context.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { AiToolId, IdeToolId, ToolId } from "../../shared/domain/tool.js";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../orchestration.error.js";

/** Registers the chosen framework source for a setup. The registration sequence is not the setup's own:
 * composition hands it in. */
export type RegisterFrameworkSource = (
  flow: Pick<SetupFlow, "projectRoot" | "scope">,
  source: FrameworkSource | null
) => Promise<void>;

/** What a setup did: `initialized` when this run created the manifest it works on, `up-to-date`
 * when one was already there. */
export interface SetupResult {
  readonly kind: "initialized" | "up-to-date";
  readonly install: InstallToolsResult;
  readonly activation: NativeActivationReport;
  readonly context?: ProjectContext;
  /** Set by a global run: the plugins it installed for every project. */
  readonly globalPlugins?: readonly string[];
}

export type PluginInstallMode = "interactive" | "all" | "recommended" | "named" | "none";

export interface SetupFlowParams {
  projectRoot: string;
  /** Every id a registered tool bears, in the order a refusal names them. */
  registeredToolIds: readonly ToolId[];
  /** The registered AI ids: what `aiTools` is picked from. */
  aiToolIds: readonly AiToolId[];
  /** The registered editor ids: what `ideTools` is picked from. */
  ideToolIds: readonly IdeToolId[];
  /** Whether `--scope user` has anywhere to point this tool, as the tool answers it. */
  supportsUserScopeActivation: (toolId: ToolId) => boolean;
  source?: FrameworkSource;
  aiTools?: readonly string[];
  ideTools?: readonly string[];
  pluginMode?: PluginInstallMode;
  pluginNames?: readonly string[];
  interactive?: boolean;
  force?: boolean;
  registerDefaultMarketplace?: boolean;
  /** `"project"` (the default) installs into this project alone. `"user"` registers
   * the shared framework source and native activation machine-wide instead, writing
   * nothing under `projectRoot`: see `architecture.md`'s user-scope section. */
  scope?: Scope;
}

export class SetupFlow {
  readonly projectRoot: string;
  readonly source?: FrameworkSource;
  readonly aiTools: readonly AiToolId[];
  readonly ideTools: readonly IdeToolId[];
  readonly pluginMode: PluginInstallMode;
  readonly pluginNames: readonly string[];
  readonly interactive: boolean;
  readonly force: boolean;
  readonly registerDefaultMarketplace: boolean;
  readonly scope: Scope;

  constructor(params: SetupFlowParams) {
    const aiTools = this.registeredAmong(
      params.registeredToolIds,
      params.aiToolIds,
      params.aiTools ?? []
    );
    const ideTools = this.registeredAmong(
      params.registeredToolIds,
      params.ideToolIds,
      params.ideTools ?? []
    );
    const pluginMode = params.pluginMode ?? "none";
    const scope = params.scope ?? "project";
    this.validatePluginMode(pluginMode, params.pluginNames ?? []);
    this.validateScope({
      supportsUserScopeActivation: params.supportsUserScopeActivation,
      scope,
      aiTools,
      ideTools,
      pluginMode,
    });
    this.projectRoot = params.projectRoot;
    this.source = params.source;
    this.aiTools = aiTools;
    this.ideTools = ideTools;
    this.pluginMode = pluginMode;
    this.pluginNames = params.pluginNames ?? [];
    this.interactive = params.interactive ?? false;
    this.force = params.force ?? false;
    this.registerDefaultMarketplace = params.registerDefaultMarketplace ?? true;
    this.scope = scope;
  }

  /** The ids of `candidates` the names spell, in the order written; a name no candidate bears is
   * refused, naming every registered id. */
  private registeredAmong<T extends ToolId>(
    registered: readonly ToolId[],
    candidates: readonly T[],
    names: readonly string[]
  ): T[] {
    return names.map((name) => {
      const id = candidates.find((candidate) => candidate === name);
      if (id === undefined) throw new InvalidSetupToolIdError(name, registered);
      return id;
    });
  }

  // `--scope user` writes nothing under `projectRoot`: an IDE tool's project-relative config has
  // nowhere to land, an AI tool with neither native activation nor a user-scope directory has
  // nowhere to be registered, an empty `--ai` list registers the shared source for no tool at
  // all, and an interactive pick has no project to offer it in. Each is refused rather than
  // silently dropped; named, recommended and all plugins install machine-wide.
  private validateScope({
    supportsUserScopeActivation,
    scope,
    aiTools,
    ideTools,
    pluginMode,
  }: {
    supportsUserScopeActivation: (toolId: ToolId) => boolean;
    scope: Scope;
    aiTools: readonly AiToolId[];
    ideTools: readonly IdeToolId[];
    pluginMode: PluginInstallMode;
  }): void {
    if (scope !== "user") return;
    if (ideTools.length > 0) throw new UserScopeIdeToolsError(ideTools);
    if (aiTools.length === 0) throw new UserScopeNoToolsError();
    const unsupported = aiTools.filter((id) => !supportsUserScopeActivation(id));
    if (unsupported.length > 0) throw new UserScopeUnsupportedAiToolsError(unsupported);
    if (pluginMode === "interactive") throw new UserScopePluginModeError();
  }

  private validatePluginMode(mode: PluginInstallMode, names: readonly string[]): void {
    if (mode === "named" && names.length === 0) {
      throw new InvalidPluginModeConfigError(
        'Plugin mode "named" requires at least one plugin name.'
      );
    }
    if (mode !== "named" && names.length > 0) {
      throw new InvalidPluginModeConfigError(
        `Plugin names provided but mode is "${mode}" (expected "named").`
      );
    }
  }
}
