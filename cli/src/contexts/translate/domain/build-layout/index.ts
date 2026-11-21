import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ToolBuildContract } from "../../../tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type { OutputFile } from "../output-file.js";
import { marketplaceAgents } from "./agents.js";
import { flatSkills } from "./flat-skills.js";
import { marketplaceHooks } from "./hooks.js";
import { marketplaceMcp } from "./mcp.js";
import { marketplaceSkills } from "./skills.js";

/** The files one plugin builds into for a tool, each named from the output directory. Only the
 * marketplace layout is built here so far. */
export function translateBuildLayout(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): OutputFile[] {
  if (mode === "flat") {
    const { skills } = contract.artifacts;
    return skills.supported ? flatSkills(canon, contract, skills) : [];
  }
  const { agents, hooks, mcp, skills } = contract.artifacts;
  return [
    ...(agents.supported ? marketplaceAgents(canon, agents) : []),
    ...(hooks.supported ? marketplaceHooks(canon, hooks, contract.pluginRootToken) : []),
    ...(mcp.supported ? marketplaceMcp(canon, mcp, contract.pluginRootToken) : []),
    ...(skills.supported ? marketplaceSkills(canon, skills) : []),
  ];
}
