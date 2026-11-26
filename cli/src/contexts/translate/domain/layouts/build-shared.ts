import type { ToolBuildContract } from "../../../../shared/domain/materialization/build-contract.js";
import { basename } from "../../../../shared/domain/paths.model.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_AGENT_INPUT_EXT, PLUGIN_SKILL_ENTRY_FILE } from "../canon-format.js";

export const isEntry = (relativePath: string): boolean =>
  basename(relativePath) === PLUGIN_SKILL_ENTRY_FILE;

/** Whether a skill file is an entry the tool finds by its folder name, so it carries that name. */
export const namedByFolder = (
  skills: ToolBuildContract["artifacts"]["skills"] | undefined,
  relativePath: string
): true | undefined =>
  skills?.supported && skills.rewriteSkillName && isEntry(relativePath) ? true : undefined;

export function agentFiles(canon: PluginDistribution): PluginComponentFile[] {
  return canon.components.agents.filter((file) =>
    file.relativePath.endsWith(PLUGIN_AGENT_INPUT_EXT)
  );
}
