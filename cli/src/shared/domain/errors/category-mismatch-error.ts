import type { ToolCategory } from "../tool.js";
import { AiddError } from "./aidd-error.js";

export class CategoryMismatchError extends AiddError {
  readonly code = "category-mismatch";
  constructor(wrong: string[], category: ToolCategory, validToolIds: readonly string[]) {
    const label = category === "ai" ? "AI" : "IDE";
    const verb = wrong.length === 1 ? `is not an ${label} tool` : `are not ${label} tools`;
    super(`${wrong.join(", ")} ${verb}. Valid ${label} tools: ${validToolIds.join(", ")}`);
    this.name = "CategoryMismatchError";
  }
}
