import { InvalidPluginScopeError } from "../errors.js";
import { getToolConfig, isAiTool } from "../tools/registry.js";
import type { AiToolId } from "./tool-ids.js";

export type InstallScope = "project" | "user";

const VALID_SCOPES: readonly string[] = ["project", "user"];

export function isInstallScope(value: unknown): value is InstallScope {
  return typeof value === "string" && VALID_SCOPES.includes(value);
}

export function parseInstallScope(value: string | undefined): InstallScope | undefined {
  if (value === undefined) return undefined;
  if (!isInstallScope(value)) {
    throw new Error(`Invalid scope '${value}'. Expected 'project' or 'user'.`);
  }
  return value;
}

export function getToolSupportedScope(toolId: AiToolId): InstallScope {
  const tool = getToolConfig(toolId);
  if (tool === undefined || !isAiTool(tool)) return "project";
  const caps = tool.capabilities as Record<string, unknown>;
  const plugins = caps.plugins as { installScope?: InstallScope } | undefined;
  return plugins?.installScope ?? "project";
}

export function assertToolSupportsScope(toolId: AiToolId, requested: InstallScope): void {
  const supported = getToolSupportedScope(toolId);
  if (supported !== requested) {
    throw new InvalidPluginScopeError(toolId, requested, supported);
  }
}
