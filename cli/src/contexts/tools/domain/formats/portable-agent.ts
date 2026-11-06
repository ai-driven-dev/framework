import { InvalidAgentFrontmatterError } from "../../../../kernel/errors.js";

/** Rebuilt, never copied: a host silently drops an agent with an unknown `model` or list-less `tools`. */
export function portableAgentFrontmatter(
  source: Record<string, unknown>,
  name: string
): Record<string, unknown> {
  const description = typeof source.description === "string" ? source.description.trim() : "";
  if (description === "") throw new InvalidAgentFrontmatterError(name, "description is empty");
  const tools = toolList(source.tools);
  return {
    name,
    description,
    model: "inherit",
    ...(tools === null ? {} : { tools }),
  };
}

function toolList(tools: unknown): string[] | null {
  if (Array.isArray(tools)) return tools.map(String);
  if (typeof tools !== "string") return null;
  const list = tools
    .split(",")
    .map((tool) => tool.trim())
    .filter((tool) => tool !== "");
  return list.length > 0 ? list : null;
}
