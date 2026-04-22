import { AIDD_DIR } from "./paths.js";

export const SYNC_EXCLUDED_FILES: ReadonlySet<string> = new Set([
  "CLAUDE.md",
  "AGENTS.md",
  ".github/copilot-instructions.md",
  ".mcp.json",
  ".cursor/mcp.json",
  ".vscode/mcp.json",
  "opencode.json",
  "opencode.jsonc",
]);

export function isSyncExcluded(relativePath: string, docsDir: string): boolean {
  if (SYNC_EXCLUDED_FILES.has(relativePath)) return true;
  if (relativePath.startsWith(".vscode/")) return true;
  if (relativePath.startsWith(`${docsDir}/`)) return true;
  if (relativePath.startsWith(`${AIDD_DIR}/`)) return true;
  return false;
}
