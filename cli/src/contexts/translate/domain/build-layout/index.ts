import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ToolBuildContract } from "../../../tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type { OutputFile } from "../output-file.js";
import { marketplaceAgents } from "./agents.js";
import { flatAgents } from "./flat-agents.js";
import { flatHooks } from "./flat-hooks.js";
import { flatSkills } from "./flat-skills.js";
import { marketplaceHooks } from "./hooks.js";
import { marketplaceMcp } from "./mcp.js";
import { marketplaceSkills } from "./skills.js";

/** The files one plugin builds into for a tool, each named from the output directory. The flat
 * layout is built here for agents, hooks and skills; its MCP servers and hooks file are merged by the sink. */
export function translateBuildLayout(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): OutputFile[] {
  return mode === "flat" ? flatFiles(canon, contract) : marketplaceFiles(canon, contract);
}

function flatFiles(canon: PluginDistribution, contract: ToolBuildContract): OutputFile[] {
  const { agents, hooks, skills } = contract.artifacts;
  return [
    ...(agents.supported ? flatAgents(canon, contract, agents) : []),
    ...(hooks.supported ? flatHooks(canon, hooks) : []),
    ...(skills.supported ? flatSkills(canon, contract, skills) : []),
  ];
}

function marketplaceFiles(canon: PluginDistribution, contract: ToolBuildContract): OutputFile[] {
  const { agents, hooks, mcp, skills } = contract.artifacts;
  return [
    ...(agents.supported ? marketplaceAgents(canon, agents) : []),
    ...(hooks.supported ? marketplaceHooks(canon, hooks, contract.pluginRootToken) : []),
    ...(mcp.supported ? marketplaceMcp(canon, mcp, contract.pluginRootToken) : []),
    ...(skills.supported ? marketplaceSkills(canon, skills) : []),
  ];
}
