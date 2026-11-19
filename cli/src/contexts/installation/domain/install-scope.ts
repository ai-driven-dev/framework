import { InvalidPluginScopeError } from "../../../shared/domain/errors.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";

export type InstallScope = Scope;

export function getToolSupportedScope(requiresUserScope: boolean): InstallScope {
  return requiresUserScope ? "user" : "project";
}

export function assertToolSupportsScope(
  toolId: AiToolId,
  requested: InstallScope,
  supported: InstallScope
): void {
  if (supported !== requested) {
    throw new InvalidPluginScopeError(toolId, requested, supported);
  }
}
