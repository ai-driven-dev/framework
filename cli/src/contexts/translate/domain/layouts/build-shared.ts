import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
import { basename } from "../../../../shared/domain/paths.model.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_SKILL_ENTRY_FILE,
} from "../canon-format.js";

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

// Only the hooks manifest has a place of its own; a script stays where the plugin ships it.
export function hooksPath(
  artifact: SupportedArtifact,
  plugin: string,
  relativePath: string
): string {
  return relativePath === PLUGIN_HOOKS_RELATIVE
    ? artifactPath(artifact, plugin, relativePath)
    : relativePath;
}
