import {
  InvalidInstallScopeError,
  InvalidPluginScopeError,
} from "../../../shared/domain/errors.js";
import type { AiToolId } from "../../../shared/domain/tool.js";

export type InstallScope = "project" | "user";

const VALID_SCOPES: readonly string[] = ["project", "user"];

export function isInstallScope(value: unknown): value is InstallScope {
  return typeof value === "string" && VALID_SCOPES.includes(value);
}

export function parseInstallScope(value: string | undefined): InstallScope | undefined {
  if (value === undefined) return undefined;
  if (!isInstallScope(value)) {
    throw new InvalidInstallScopeError(value);
  }
  return value;
}

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
