import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId, IdeToolId, ToolId } from "../../../../shared/domain/tool.js";
import {
  InvalidPluginModeConfigError,
  InvalidSetupToolIdError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
} from "../installation.error.js";

export type PluginInstallMode = "interactive" | "all" | "recommended" | "named" | "none";

/** The ids of `candidates` the names spell, in the order written; a name no candidate bears is
 * refused, naming every registered id. */
export function idsAmong<T extends ToolId>(
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

/** Plugin names go with mode `named` and with no other. */
export function validatePluginMode(mode: PluginInstallMode, names: readonly string[]): void {
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

/** `--scope user` writes nothing under the project: an IDE tool's project-relative config has
 * nowhere to land, an AI tool with neither native activation nor a user-scope directory has
 * nowhere to be registered, an empty `--ai` list registers the shared source for no tool at
 * all, and an interactive pick has no project to offer it in. Each is refused rather than
 * silently dropped; named, recommended and all plugins install machine-wide. */
export function validateUserScope({
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
