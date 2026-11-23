import { ActiveMachineDependentsError } from "../../contract/installation.error.js";
import type { UserScopeInspection } from "../../ports/user-scope/user-scope-purge.js";

/** Refuses when anything still depends on what a purge would remove. */
export function assertNothingDepends(inspection: UserScopeInspection): void {
  if (inspection.activePluginDependents.length > 0) {
    throw new ActiveMachineDependentsError(
      "user-scope plugin files",
      inspection.activePluginDependents
    );
  }
  if (inspection.referencingProjects.length > 0) {
    throw new ActiveMachineDependentsError(
      "the shared framework source",
      inspection.referencingProjects
    );
  }
}
