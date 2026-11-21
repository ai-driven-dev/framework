import type { HostRegistrationFinding } from "../../contexts/host-registration/contract/inspect-host-registration-result.js";
import type { MarketplaceSourceDriftFound } from "../../contexts/host-registration/contract/marketplace-source-drift.js";
import type { DoctorIssue } from "../../contexts/installation/contract/doctor-issue.js";
import type { AiToolId } from "../../shared/domain/tool.js";

/** Words a host registry finding as the doctor issue a person reads. */
export function registrationIssueOf(finding: HostRegistrationFinding): DoctorIssue {
  const { tool } = finding;
  switch (finding.kind) {
    case "registry-unanswerable":
      return {
        severity: "info",
        message: finding.detail,
        fix: `The plugin does not load until ${tool}'s own CLI has run and answered this.`,
      };
    case "plugin-unrecorded":
      return {
        severity: "info",
        message: `AIDD records no marketplace for ${finding.plugin} (${tool}), so its registry cannot be asked`,
        fix: `${tool} will not load it until a marketplace is recorded for it.`,
      };
    case "plugin-missing":
      return {
        severity: "error",
        message: `${tool}'s registry (${finding.location}) does not carry ${finding.ref}`,
        fix: { code: "sync-reregister" },
      };
    case "plugin-disabled":
      return {
        severity: "error",
        message: `${tool}'s registry (${finding.location}) carries ${finding.ref} and records it disabled`,
        fix: { code: "install-framework", tool },
      };
    case "source-drift":
      return driftIssue(tool, finding.found);
    case "source-conflict": {
      const check = finding;
      return {
        severity: "error",
        message: `${tool}'s marketplace registry (${check.location}) carries '${check.name}' from a different catalog (${check.registeredSource}) than this project's own (${check.requestedSource}) — plugins ${finding.pluginDiff}`,
        fix: { code: "replace-conflicting-source", name: check.name },
      };
    }
  }
}

/** Both `warning`, never `error`: neither drift is a fault this project caused, and neither
 * blocks anything the way a genuine different-catalog conflict does. */
function driftIssue(toolId: AiToolId, found: MarketplaceSourceDriftFound): DoctorIssue {
  const { drift } = found;
  if (drift.kind === "version-behind") {
    return {
      severity: "warning",
      message: `${toolId}'s marketplace registry (${found.location}) already carries a newer aidd-framework build, ${drift.registeredVersion}, than this run's own ${drift.requestedVersion}`,
      fix: { code: "update-cli" },
    };
  }
  if (drift.kind === "unmigrated-foreign-project-source") {
    return {
      severity: "warning",
      message: `${toolId}'s marketplace registry (${found.location}) still carries '${found.name}' from another project's pre-migration cache (${found.registeredSource})`,
      fix: { code: "sync-migrate-source" },
    };
  }
  return {
    severity: "warning",
    message: `${toolId}'s marketplace registry (${found.location}) still carries '${found.name}' from this project's own pre-migration cache (${found.registeredSource})`,
    fix: { code: "sync-migrate-source" },
  };
}
