import { CategoryMismatchError, UnknownAiToolIdError, UnknownToolCategoryError } from "./errors.js";

export type AiToolId =
  | "claude"
  | "cursor"
  | "copilot"
  | "opencode"
  | "kilo"
  | "codex"
  | "antigravity";
export type IdeToolId = "vscode";
export type ToolId = AiToolId | IdeToolId;
export type ToolCategory = "ai" | "ide";

export const AI_TOOL_IDS: readonly AiToolId[] = [
  "claude",
  "cursor",
  "copilot",
  "opencode",
  "kilo",
  "codex",
  "antigravity",
];
export const IDE_TOOL_IDS: readonly IdeToolId[] = ["vscode"];
export const VALID_TOOL_IDS: readonly ToolId[] = [...AI_TOOL_IDS, ...IDE_TOOL_IDS];

export function isAiToolId(id: string): id is AiToolId {
  return AI_TOOL_IDS.includes(id as AiToolId);
}

export function isIdeToolId(id: string): id is IdeToolId {
  return (IDE_TOOL_IDS as readonly string[]).includes(id);
}

export function toolIdsForCategory(category: ToolCategory): readonly ToolId[] {
  switch (category) {
    case "ai":
      return AI_TOOL_IDS;
    case "ide":
      return IDE_TOOL_IDS;
    default: {
      const _exhaustive: never = category;
      throw new UnknownToolCategoryError(String(_exhaustive));
    }
  }
}

export function assertToolIdsMatchCategory(toolIds: ToolId[], category: ToolCategory): void {
  const allowed = toolIdsForCategory(category);
  const wrong = toolIds.filter((id) => !(allowed as readonly string[]).includes(id));
  if (wrong.length === 0) return;
  throw new CategoryMismatchError(wrong, category, allowed);
}

export function parseToolOption(tool: string | undefined): AiToolId[] | "all" {
  if (tool === undefined || tool === "all") return "all";
  return [tool as AiToolId];
}

export function assertValidAiToolId(tool: string | undefined): void {
  if (tool === undefined || tool === "all") return;
  if (!isAiToolId(tool)) {
    throw new UnknownAiToolIdError(tool, AI_TOOL_IDS);
  }
}
