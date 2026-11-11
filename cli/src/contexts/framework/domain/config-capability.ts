import type { HooksCapability } from "../../tools/domain/capabilities/hooks-capability.js";
import type { McpCapability } from "../../tools/domain/capabilities/mcp-capability.js";
import type { SettingsCapability } from "../../tools/domain/capabilities/settings-capability.js";
import type { ToolConfig } from "../../tools/domain/registry.js";

export type ConfigCapability = McpCapability | HooksCapability | SettingsCapability;

export function extractConfigCapabilities(config: ToolConfig): ConfigCapability[] {
  const result: ConfigCapability[] = [];

  if (config.kind === "ai") {
    const mcp = config.section("mcp");
    if (mcp !== null) result.push(mcp);
    const hooks = config.section("hooks");
    if (hooks !== null) result.push(hooks);
  }

  const settings = config.section("settings");
  if (settings !== null) result.push(...(Array.isArray(settings) ? settings : [settings]));

  return result;
}
