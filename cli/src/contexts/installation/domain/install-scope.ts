import { InvalidPluginScopeError } from "../../../shared/domain/errors.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";

export function getToolSupportedScope(requiresUserScope: boolean): Scope {
  return requiresUserScope ? "user" : "project";
}

export function assertToolSupportsScope(
  toolId: AiToolId,
  requested: Scope,
  supported: Scope
): void {
  if (supported !== requested) {
    throw new InvalidPluginScopeError(toolId, requested, supported);
  }
}
