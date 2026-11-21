import { relative } from "node:path";
import type { PluginComponentFile } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { PluginPresence } from "../../../tools/contract/build-contract.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
  PLUGIN_SKILL_ENTRY_FILE,
} from "../../domain/canon-format.js";
import type { PluginSource } from "../../ports/disk-sink-deps.js";

/** A plugin's canon as one distribution: every file under its folder, read once, as the
 * "/"-separated path inside the plugin. The build never reads the version, so none is claimed. */
export async function readPluginCanon(
  fs: FileReader,
  plugin: PluginSource,
  format: AiToolId
): Promise<PluginDistribution> {
  const files: PluginComponentFile[] = [];
  for (const absPath of await fs.listFilesRecursive(plugin.src)) {
    files.push({
      relativePath: relative(plugin.src, absPath).replace(/\\/g, "/"),
      content: await fs.readFile(absPath),
    });
  }
  const under = (dir: string) => files.filter((file) => file.relativePath.startsWith(`${dir}/`));
  return new PluginDistribution({
    manifest: { name: plugin.name, version: "" },
    format,
    files,
    components: {
      commands: under("commands"),
      agents: under("agents"),
      skills: under("skills"),
      rules: under("rules"),
      hooks: under("hooks"),
      mcp: files.filter((file) => file.relativePath === PLUGIN_MCP_RELATIVE),
    },
  });
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
    hasMcpJson: dist.components.mcp.length > 0,
  };
}
