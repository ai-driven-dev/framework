/** What the recommendation reads of a project: the stack and whether the framework is already there. */
export interface RecommendationContext {
  readonly stack: "typescript" | "python" | "unknown";
  readonly isMonorepo: boolean;
  readonly hasFramework: boolean;
}

export function recommendAiTools(context?: RecommendationContext): readonly string[] {
  if (context === undefined) return ["claude"];
  if (context.hasFramework) return [];
  if (context.isMonorepo) return ["claude", "copilot"];
  if (context.stack === "typescript") return ["claude", "copilot"];
  if (context.stack === "python") return ["claude", "codex"];
  return ["claude"];
}

export function recommendIdeTools(context?: RecommendationContext): readonly string[] {
  if (context === undefined) return [];
  if (context.hasFramework) return [];
  if (context.stack === "typescript" || context.isMonorepo) return ["vscode"];
  return [];
}
