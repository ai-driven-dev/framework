import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import {
  idsAmong,
  type PluginInstallMode,
  validatePluginMode,
  validateUserScope,
} from "../../contexts/installation/contract/setup/setup-request-rules.model.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { AiToolId, IdeToolId, ToolId } from "../../shared/domain/tool.js";

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

/** What a setup asks for once every unanswered option has its default. */
function withDefaults(params: SetupFlowParams) {
  return {
    aiTools: params.aiTools ?? [],
    ideTools: params.ideTools ?? [],
    pluginMode: params.pluginMode ?? "none",
    pluginNames: params.pluginNames ?? [],
    interactive: params.interactive ?? false,
    force: params.force ?? false,
    registerDefaultMarketplace: params.registerDefaultMarketplace ?? true,
    scope: params.scope ?? "project",
  };
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
    const given = withDefaults(params);
    const aiTools = idsAmong(params.registeredToolIds, params.aiToolIds, given.aiTools);
    const ideTools = idsAmong(params.registeredToolIds, params.ideToolIds, given.ideTools);
    validatePluginMode(given.pluginMode, given.pluginNames);
    validateUserScope({
      supportsUserScopeActivation: params.supportsUserScopeActivation,
      scope: given.scope,
      aiTools,
      ideTools,
      pluginMode: given.pluginMode,
    });
    this.projectRoot = params.projectRoot;
    this.source = params.source;
    this.aiTools = aiTools;
    this.ideTools = ideTools;
    this.pluginMode = given.pluginMode;
    this.pluginNames = given.pluginNames;
    this.interactive = given.interactive;
    this.force = given.force;
    this.registerDefaultMarketplace = given.registerDefaultMarketplace;
    this.scope = given.scope;
  }
}
