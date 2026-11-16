import type { ToolCategory } from "../../shared/domain/tool.js";

const CATEGORIES: readonly ToolCategory[] = ["ai", "ide"];

/** Runs `run` for each tool category in turn, or for `only` alone, and collects the answers. */
export async function forEachCategory<R>(
  run: (category: ToolCategory) => Promise<R>,
  only?: ToolCategory
): Promise<R[]> {
  const answers: R[] = [];
  for (const category of only === undefined ? CATEGORIES : [only]) {
    answers.push(await run(category));
  }
  return answers;
}
