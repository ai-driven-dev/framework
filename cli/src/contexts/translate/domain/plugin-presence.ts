import type { PluginPresence } from "../../../shared/domain/materialization/build-contract.js";
import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_SKILL_ENTRY_FILE,
} from "./canon-format.js";

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
    hasMcpJson: dist.components.mcp.length > 0,
  };
}
