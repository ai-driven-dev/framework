import { type AgentFrontmatter, pickFrontmatterKeys } from "../../formats/agent-format.js";

/** Claude Code reads its own keys; an agent without `tools` inherits every tool. */
export const claudeAgentFrontmatter: AgentFrontmatter = (fm) =>
  pickFrontmatterKeys(fm, ["name", "description", "model", "effort"]);
