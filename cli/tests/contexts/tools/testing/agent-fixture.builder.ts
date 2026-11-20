import type { AiTool, WithSections } from "../../../../src/contexts/tools/domain/profile.js";

/** A Claude-format agent carrying every key a host may translate. */
export const NAMED_AGENT = `---
name: planner
description: Plans the work
model: m
effort: high
---
Plan before building.
`;

export const UNNAMED_AGENT = `---
description: Plans the work
---
Plan before building.
`;

/** What a plugin install writes for `planner.md`. */
export function installed(tool: AiTool<WithSections<"agents">>, content: string): string {
  const agents = tool.section("agents");
  const { frontmatter, body } = agents.deserialize(content);
  return agents.serialize(agents.convertFrontmatter(frontmatter, "planner.md"), body);
}

/** Where and what a marketplace build writes for the plugin's `planner.md`. The flat build
 * is checked against the shipped agents in `tests/composition/shipped-agents.integration.test.ts`. */
export function inMarketplace(
  tool: AiTool<WithSections<"agents">>,
  content: string
): { path: string; content: string } {
  const agents = tool.buildContracts?.marketplace?.().artifacts.agents;
  if (!agents?.supported) throw new Error(`${tool.toolId} builds no marketplace agent`);
  return {
    path: agents.path("aidd-dev", "agents/planner.md"),
    content: agents.transform?.(content, "aidd-dev", "planner.md") ?? content,
  };
}
