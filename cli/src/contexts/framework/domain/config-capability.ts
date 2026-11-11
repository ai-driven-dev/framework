import { HooksCapability } from "../../tools/domain/capabilities/hooks-capability.js";
import { McpCapability } from "../../tools/domain/capabilities/mcp-capability.js";
import { SettingsCapability } from "../../tools/domain/capabilities/settings-capability.js";
import { sectionOf, type ToolConfig } from "../../tools/domain/registry.js";

export type ConfigCapability = McpCapability | HooksCapability | SettingsCapability;

export function extractConfigCapabilities(config: ToolConfig): ConfigCapability[] {
  const result: ConfigCapability[] = [];

  if ("settings" in config) {
    const s = (config as { settings: unknown }).settings;
    if (s instanceof SettingsCapability) result.push(s);
    else if (Array.isArray(s)) result.push(...(s as SettingsCapability[]));
  }

  if (config.kind === "ai") {
    const mcp = sectionOf(config, "mcp");
    if (mcp instanceof McpCapability) result.push(mcp);
    const hooks = sectionOf(config, "hooks");
    if (hooks instanceof HooksCapability) result.push(hooks);
    const settings = sectionOf(config, "settings");
    if (settings instanceof SettingsCapability) result.push(settings);
    if (Array.isArray(settings)) result.push(...settings);
  }

  return result;
}
