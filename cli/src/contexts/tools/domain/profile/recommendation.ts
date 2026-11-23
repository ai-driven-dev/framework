/** When a tool is recommended for a project: named predicates a profile references. */
import type { RecommendationContext } from "../../contract/tool-catalog.js";

/** Recommended whatever the project is. */
export function everyProject(): boolean {
  return true;
}

/** Recommended for a TypeScript project or any monorepo. */
export function typescriptOrMonorepo(project: RecommendationContext | undefined): boolean {
  return project !== undefined && (project.isMonorepo || project.stack === "typescript");
}

/** Recommended for a Python project kept in a single repository. */
export function singlePythonRepo(project: RecommendationContext | undefined): boolean {
  return project?.stack === "python" && !project.isMonorepo;
}
