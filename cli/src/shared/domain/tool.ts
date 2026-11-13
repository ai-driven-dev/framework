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

/** Answers a written id with the tool it names, or `null` when no registered tool bears it. */
export type ToolIdResolver = (raw: string) => ToolId | null;
