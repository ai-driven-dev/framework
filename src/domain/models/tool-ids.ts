export type AiToolId = "claude" | "cursor" | "copilot" | "opencode" | "codex";
export type IdeToolId = "vscode";
export type ToolId = AiToolId | IdeToolId;
export type ToolCategory = "ai" | "ide";

export const AI_TOOL_IDS: readonly AiToolId[] = [
  "claude",
  "cursor",
  "copilot",
  "opencode",
  "codex",
];
export const IDE_TOOL_IDS: readonly IdeToolId[] = ["vscode"];
export const VALID_TOOL_IDS: readonly ToolId[] = [...AI_TOOL_IDS, ...IDE_TOOL_IDS];
