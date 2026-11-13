import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../../../shared/domain/errors.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, IdeToolId, ToolId } from "../../../shared/domain/tool.js";
import type { MarketplaceSourceMode } from "../../distribution/domain/marketplace-source-mode.js";

export type PluginInstallMode = "interactive" | "all" | "recommended" | "named" | "none";

/** Same value domain as `MarketplaceScope`, aliased so this field reads about a setup's own scope
 * rather than about the shared type it aliases. */
export type SetupScope = MarketplaceScope;

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
  source?: MarketplaceSourceMode;
  aiTools?: readonly string[];
  ideTools?: readonly string[];
  pluginMode?: PluginInstallMode;
  pluginNames?: readonly string[];
  interactive?: boolean;
  force?: boolean;
  registerDefaultMarketplace?: boolean;
  /** `"project"` (the default) installs into this project alone. `"user"` registers
   * the shared framework source and native activation machine-wide instead, writing
   * nothing under `projectRoot` — see `architecture.md`'s user-scope section. */
  scope?: SetupScope;
}

export class SetupFlow {
  readonly projectRoot: string;
  readonly source?: MarketplaceSourceMode;
  readonly aiTools: readonly AiToolId[];
  readonly ideTools: readonly IdeToolId[];
  readonly pluginMode: PluginInstallMode;
  readonly pluginNames: readonly string[];
  readonly interactive: boolean;
  readonly force: boolean;
  readonly registerDefaultMarketplace: boolean;
  readonly scope: SetupScope;

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
    this.validatePluginMode(params.pluginMode ?? "none", params.pluginNames ?? []);
    this.validateScope(
      params.supportsUserScopeActivation,
      params.scope ?? "project",
      aiTools,
      ideTools,
      params.pluginMode ?? "none"
    );
    this.projectRoot = params.projectRoot;
    this.source = params.source;
    this.aiTools = aiTools;
    this.ideTools = ideTools;
    this.pluginMode = params.pluginMode ?? "none";
    this.pluginNames = params.pluginNames ?? [];
    this.interactive = params.interactive ?? false;
    this.force = params.force ?? false;
    this.registerDefaultMarketplace = params.registerDefaultMarketplace ?? true;
    this.scope = params.scope ?? "project";
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
  private validateScope(
    supportsUserScopeActivation: (toolId: ToolId) => boolean,
    scope: SetupScope,
    aiTools: readonly AiToolId[],
    ideTools: readonly IdeToolId[],
    pluginMode: PluginInstallMode
  ): void {
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
