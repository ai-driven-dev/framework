import { AIDD_DIR } from "../../../kernel/paths.js";
import type { ToolId } from "../../../kernel/tool.js";
import type { Manifest } from "./manifest.js";

/**
 * The `.gitignore` lines this CLI's own writes require. Install adds exactly these in one call and
 * `clean` removes exactly the same set, so both read this one list and neither can drift.
 */
export function aiddGitignoreEntries(
  manifest: Manifest,
  machineLocalFilesOf: (toolId: ToolId) => readonly string[]
): string[] {
  const machineLocal = manifest
    .getInstalledToolIds()
    .flatMap((toolId) => machineLocalFilesOf(toolId));
  return [`${AIDD_DIR}/cache/`, ...new Set(machineLocal)];
}
