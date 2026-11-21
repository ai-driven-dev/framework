import type { ToolHealth } from "./doctor-issue.js";

/** What a doctor run reads of the installation record: the health of each installed tool and
 * the ids of them all. Opaque on purpose: the manifest itself stays inside installation. */
export interface InstalledToolsView {
  readonly toolHealth: readonly ToolHealth[];
  readonly toolIds: readonly string[];
}
