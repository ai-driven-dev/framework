import type { ProjectContext } from "./project-context.js";

export function recommendAiTools(context?: ProjectContext): readonly string[] {
  if (context === undefined) return ["claude"];
  if (context.hasFramework) return [];
  if (context.isMonorepo) return ["claude", "copilot"];
  if (context.stack === "typescript") return ["claude", "copilot"];
  if (context.stack === "python") return ["claude", "codex"];
  return ["claude"];
}

export function recommendIdeTools(context?: ProjectContext): readonly string[] {
  if (context === undefined) return [];
  if (context.hasFramework) return [];
  if (context.stack === "typescript" || context.isMonorepo) return ["vscode"];
  return [];
}
