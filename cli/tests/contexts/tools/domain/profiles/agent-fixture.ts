import type { AiTool, HasAgents } from "../../../../../src/contexts/tools/domain/contracts.js";

/** A Claude-format agent carrying every key a host may translate, and one none keeps. */
export const NAMED_AGENT = `---
name: planner
description: Plans the work
model: m
effort: high
tools: Read
---
Plan before building.
`;

export const UNNAMED_AGENT = `---
description: Plans the work
---
Plan before building.
`;

/** What a plugin install writes for `planner.md`. */
export function installed(tool: AiTool<HasAgents>, content: string): string {
  const agents = tool.capabilities.agents;
  const { frontmatter, body } = agents.deserialize(content);
  return agents.serialize(agents.convertFrontmatter(frontmatter, "planner.md"), body);
}

/** Where and what a built distribution writes for the plugin's `planner.md`. */
export function built(
  tool: AiTool<HasAgents>,
  mode: "marketplace" | "flat",
  content: string
): { path: string; content: string } {
  const contract =
    mode === "flat" ? tool.buildContracts?.flat?.() : tool.buildContracts?.marketplace?.();
  const agents = contract?.artifacts.agents;
  if (!agents?.supported) throw new Error(`${tool.toolId} builds no ${mode} agent`);
  return {
    path: agents.path("aidd-dev", "agents/planner.md"),
    content: agents.transform?.(content, "aidd-dev", "planner.md") ?? content,
  };
}
