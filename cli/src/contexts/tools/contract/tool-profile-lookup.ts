import { UnregisteredToolError } from "../../../kernel/errors.js";
import type { AiToolId, IdeToolId, ToolId } from "../../../kernel/tool.js";
import type { AiToolProfile, IdeToolProfile, ToolProfile } from "./tool-profile.js";

/** The profile an install was handed for `id`; an id it was not handed is refused. */
export function profileOf(tools: readonly ToolProfile[], id: ToolId): ToolProfile {
  const found = tools.find((tool) => tool.toolId === id);
  if (found === undefined) throw new UnregisteredToolError(id);
  return found;
}

export function aiProfileOf(tools: readonly ToolProfile[], id: AiToolId): AiToolProfile {
  const profile = profileOf(tools, id);
  if (profile.kind !== "ai") throw new UnregisteredToolError(id);
  return profile;
}

export function ideProfileOf(tools: readonly ToolProfile[], id: IdeToolId): IdeToolProfile {
  const profile = profileOf(tools, id);
  if (profile.kind !== "ide") throw new UnregisteredToolError(id);
  return profile;
}
