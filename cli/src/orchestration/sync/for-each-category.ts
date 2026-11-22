import type { ToolCategory } from "../../shared/domain/tool.js";
import type { GlobalExecutionError } from "../domain/global-execution.model.js";

const CATEGORIES: readonly ToolCategory[] = ["ai", "ide"];

export interface CategoryRuns<T> {
  /** One entry per category: its result, or null when that category failed. */
  results: Record<ToolCategory, T | null>;
  errors: GlobalExecutionError[];
}

/** Runs one step per category, ai then ide. A category that throws is reported and the other
 * still runs, so one that cannot be checked never hides the rest. */
export async function forEachCategory<T>(
  run: (category: ToolCategory) => Promise<T>
): Promise<CategoryRuns<T>> {
  const errors: GlobalExecutionError[] = [];
  const results: Record<ToolCategory, T | null> = { ai: null, ide: null };
  for (const category of CATEGORIES) {
    try {
      results[category] = await run(category);
    } catch (err) {
      errors.push({ scope: category, error: err });
    }
  }
  return { results, errors };
}
