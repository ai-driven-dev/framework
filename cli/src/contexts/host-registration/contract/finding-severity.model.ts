import type { HostRegistrationFinding } from "./inspect-host-registration-result.js";

export type FindingSeverity = "info" | "warning" | "error";

/** A marketplace the project no longer declares is stale, never a fault that blocks anything. */
export const UNDECLARED_MARKETPLACE_SEVERITY: FindingSeverity = "warning";

/** How serious a host registry finding is. An unanswered registry or an unrecorded marketplace is
 * information; a drift is a `warning`, never an `error`, since the project did not cause it and it
 * blocks nothing; a missing or disabled plugin and a different-catalog conflict are errors. */
export function findingSeverity(finding: HostRegistrationFinding): FindingSeverity {
  switch (finding.kind) {
    case "registry-unanswerable":
    case "plugin-unrecorded":
      return "info";
    case "source-drift":
      return "warning";
    case "plugin-missing":
    case "plugin-disabled":
    case "source-conflict":
      return "error";
  }
}
