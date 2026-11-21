import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ToolBuildContract } from "../../../tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type { OutputFile } from "../output-file.js";
import { marketplaceAgents } from "./agents.js";
import { marketplaceSkills } from "./skills.js";

/** The files one plugin builds into for a tool, each named from the output directory. Only the
 * marketplace layout is built here so far. */
export function translateBuildLayout(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): OutputFile[] {
  if (mode !== "marketplace") return [];
  const { agents, skills } = contract.artifacts;
  return [
    ...(agents.supported ? marketplaceAgents(canon, agents) : []),
    ...(skills.supported ? marketplaceSkills(canon, skills) : []),
  ];
}
