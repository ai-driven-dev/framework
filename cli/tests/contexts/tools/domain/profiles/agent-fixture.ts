import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiTool, HasAgents } from "../../../../../src/contexts/tools/domain/contracts.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";

const PLUGIN = "aidd-orchestrator";
const FILE = "explorer.md";

/** The agent the repository ships, as a plugin install reads it. */
export const NAMED_AGENT = readFileSync(
  join(REPOSITORY_ROOT, "plugins", PLUGIN, "agents", FILE),
  "utf8"
);

const CLOSING = "\n---\n";

/** Read with plain string operations, not the CLI's parser, so a parser bug cannot hide in both sides. */
export const DESCRIPTION = /^description: (.*)$/m.exec(NAMED_AGENT)?.[1] ?? "";
export const BODY = NAMED_AGENT.slice(NAMED_AGENT.indexOf(CLOSING, 3) + CLOSING.length);

export const UNNAMED_AGENT = NAMED_AGENT.replace(/^name: .*\n/m, "");

/** The real agent with the model and effort a provider writes; it declares neither itself. */
export function withModel(content: string): string {
  const closing = content.indexOf(CLOSING, 3);
  return `${content.slice(0, closing)}\nmodel: m\neffort: high${content.slice(closing)}`;
}

/** What a plugin install writes for the agent's file. */
export function installed(tool: AiTool<HasAgents>, content: string): string {
  const agents = tool.capabilities.agents;
  const { frontmatter, body } = agents.deserialize(content);
  return agents.serialize(agents.convertFrontmatter(frontmatter, FILE), body);
}

/** Where and what a built distribution writes for the plugin's agent file. */
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
    path: agents.path(PLUGIN, `agents/${FILE}`),
    content: agents.transform?.(content, PLUGIN, FILE) ?? content,
  };
}
