import { ManifestValidationError } from "../errors.js";
import type { ToolId } from "./tool-config.js";

export type UpdateScope = { kind: "all" } | { kind: "docs" } | { kind: "tool"; toolId: ToolId };

export function parseUpdateScope(raw: string): UpdateScope {
  if (raw === "all") return { kind: "all" };
  if (raw === "docs") return { kind: "docs" };
  if (raw.startsWith("tool:")) {
    const toolId = raw.slice(5) as ToolId;
    return { kind: "tool", toolId };
  }
  throw new ManifestValidationError(`Invalid update scope: "${raw}"`);
}

export function formatToolScopeValue(toolId: ToolId): string {
  return `tool:${toolId}`;
}
