import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_AGENT_INPUT_EXT, PLUGIN_SKILL_ENTRY_FILE } from "../canon-format.js";

export const baseOf = (relativePath: string): string =>
  relativePath.split("/").at(-1) ?? relativePath;

export const isEntry = (relativePath: string): boolean =>
  baseOf(relativePath) === PLUGIN_SKILL_ENTRY_FILE;

export function agentFiles(canon: PluginDistribution): PluginComponentFile[] {
  return canon.components.agents.filter((file) =>
    file.relativePath.endsWith(PLUGIN_AGENT_INPUT_EXT)
  );
}
