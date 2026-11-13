/** Kiro CLI V3 refuses a profile still carrying 2.x fields such as `allowedTools`, so only the
 * current schema's keys are written. `tools: ["*"]` keeps every built-in tool available. */

import type { AgentFrontmatter } from "../../formats/agent-format.js";

const text = (value: unknown): string => (typeof value === "string" ? value : "");

export const kiroAgentFrontmatter: AgentFrontmatter = (fm) => ({
  name: text(fm.name),
  description: text(fm.description),
  tools: ["*"],
});

export function kiroAgentJson(frontmatter: Record<string, unknown>, body: string): string {
  const { tools, ...rest } = frontmatter;
  return `${JSON.stringify({ ...rest, prompt: body.trim(), tools }, null, 2)}\n`;
}
