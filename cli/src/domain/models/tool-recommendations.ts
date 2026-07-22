import type { ProjectContext } from "./project-context.js";
import type { AiToolId, IdeToolId } from "./tool-ids.js";

export function recommendAiTools(context?: ProjectContext): readonly AiToolId[] {
  if (context === undefined) return ["claude"];
  if (context.hasFramework) return [];
  if (context.isMonorepo) return ["claude", "copilot"];
  if (context.stack === "typescript") return ["claude", "copilot"];
  if (context.stack === "python") return ["claude", "codex"];
  return ["claude"];
}

export function recommendIdeTools(context?: ProjectContext): readonly IdeToolId[] {
  if (context === undefined) return [];
  if (context.hasFramework) return [];
  if (context.stack === "typescript" || context.isMonorepo) return ["vscode"];
  return [];
}
