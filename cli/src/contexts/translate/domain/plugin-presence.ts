import type { PluginPresence } from "../../../shared/domain/materialization/plugin-presence.js";
import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import { hookEventsOf } from "../../../shared/domain/reading/hook-events.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_SKILL_ENTRY_FILE,
  parsedMcpDeclaration,
} from "./canon-format.js";

/** The servers the plugin's `.mcp.json` declares, none when it declares no `mcpServers` object. */
function mcpServersOf(dist: PluginDistribution): Readonly<Record<string, unknown>> {
  return asPlainObject(asPlainObject(parsedMcpDeclaration(dist))?.mcpServers) ?? {};
}

/** The events the plugin's `hooks.json` declares, none when it ships no such file. */
function hooksOf(dist: PluginDistribution): Readonly<Record<string, unknown>> {
  const file = dist.components.hooks.find((hooks) => hooks.relativePath === PLUGIN_HOOKS_RELATIVE);
  return file === undefined ? {} : hookEventsOf(file.content);
}

/** What a plugin's canon holds, for the manifest a tool synthesizes from it. */
export function presenceOf(dist: PluginDistribution): PluginPresence {
  const agentsList = dist.components.agents
    .map((file) => file.relativePath.slice("agents/".length))
    .filter((path) => path.endsWith(PLUGIN_AGENT_INPUT_EXT))
    .sort();
  const skillNames = new Set<string>();
  for (const { relativePath } of dist.components.skills) {
    const parts = relativePath.slice("skills/".length).split("/");
    if (parts.length >= 2 && parts.at(-1) === PLUGIN_SKILL_ENTRY_FILE) skillNames.add(parts[0]);
  }
  return {
    hasAgents: agentsList.length > 0,
    agentsList,
    skillsList: [...skillNames].sort(),
    hasHooksJson: dist.components.hooks.some((file) => file.relativePath === PLUGIN_HOOKS_RELATIVE),
    get hooks() {
      return hooksOf(dist);
    },
    hasMcpJson: dist.components.mcp.length > 0,
    mcpServers: mcpServersOf(dist),
  };
}
