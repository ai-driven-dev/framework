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
import type { ComponentPlan } from "../rules/component-pipeline.js";

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

/** A file below `hooks/` as the tool's marketplace build writes it: the manifest through the
 * tool's conversion, with what that conversion warns of, any other JSON file reshaped. */
export function convertedHooksFile(
  artifact: SupportedArtifact,
  { relativePath, content }: PluginComponentFile,
  { plugin, carriesRelease }: { readonly plugin: string; readonly carriesRelease: boolean }
): Pick<ComponentPlan, "content" | "shape"> & { readonly warnings: readonly string[] } {
  const { convertHooks, transform } = artifact;
  if (relativePath === PLUGIN_HOOKS_RELATIVE && convertHooks !== undefined) {
    return convertHooks(content, plugin, carriesRelease);
  }
  const shape =
    transform !== undefined && relativePath.endsWith(".json")
      ? (text: string) => transform(text, plugin, basename(relativePath))
      : undefined;
  return { content, shape, warnings: [] };
}
