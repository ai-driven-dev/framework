import type { AiToolId } from "../tool.js";

export interface PluginTranslationSkip {
  readonly pluginName: string;
  readonly component: "hooks" | "mcp" | "scripts";
  readonly toolId: AiToolId;
  readonly reason: string;
}

export type ReadonlySkipList = readonly PluginTranslationSkip[];

/** A warning of a hooks route, under the tool it is reported for: the one prefix every route writes. */
export function toolWarning(tool: string, warning: string): string {
  return `${tool}: ${warning}`;
}

/** A plugin's hooks a tool did not take whole, and why. */
export function hooksSkip(
  pluginName: string,
  toolId: AiToolId,
  reason: string
): PluginTranslationSkip {
  return { pluginName, component: "hooks", toolId, reason };
}
