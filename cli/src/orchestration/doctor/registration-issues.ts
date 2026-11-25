import { findingSeverity } from "../../contexts/host-registration/contract/finding-severity.model.js";
import type { HostRegistrationFinding } from "../../contexts/host-registration/contract/inspect-host-registration-result.js";
import type { MarketplaceSourceDriftFound } from "../../contexts/host-registration/contract/marketplace-source-drift.js";
import type { DoctorIssue } from "../../contexts/installation/contract/doctor-issue.js";
import type { AiToolId } from "../../shared/domain/tool.js";

/** Words a host registry finding as the doctor issue a person reads. */
export function registrationIssueOf(finding: HostRegistrationFinding): DoctorIssue {
  return { severity: findingSeverity(finding), ...wordingOf(finding) };
}

function wordingOf(finding: HostRegistrationFinding): Pick<DoctorIssue, "message" | "fix"> {
  const { tool } = finding;
  switch (finding.kind) {
    case "registry-unanswerable":
      return {
        message: finding.detail,
        fix: `The plugin does not load until ${tool}'s own CLI has run and answered this.`,
      };
    case "plugin-unrecorded":
      return {
        message: `AIDD records no marketplace for ${finding.plugin} (${tool}), so its registry cannot be asked`,
        fix: `${tool} will not load it until a marketplace is recorded for it.`,
      };
    case "plugin-missing":
      return {
        message: `${tool}'s registry (${finding.location}) does not carry ${finding.ref}`,
        fix: { code: "sync-reregister" },
      };
    case "plugin-disabled":
      return {
        message: `${tool}'s registry (${finding.location}) carries ${finding.ref} and records it disabled`,
        fix: { code: "install-framework", tool },
      };
    case "source-drift":
      return driftIssue(tool, finding.found);
    case "source-conflict": {
      const check = finding;
      return {
        message: `${tool}'s marketplace registry (${check.location}) carries '${check.name}' from a different catalog (${check.registeredSource}) than this project's own (${check.requestedSource}) — plugins ${finding.pluginDiff}`,
        fix: { code: "replace-conflicting-source", name: check.name },
      };
    }
  }
}

/** The words of a drift. */
function driftIssue(
  toolId: AiToolId,
  found: MarketplaceSourceDriftFound
): Pick<DoctorIssue, "message" | "fix"> {
  const { drift } = found;
  if (drift.kind === "version-behind") {
    return {
      message: `${toolId}'s marketplace registry (${found.location}) already carries a newer aidd-framework build, ${drift.registeredVersion}, than this run's own ${drift.requestedVersion}`,
      fix: { code: "update-cli" },
    };
  }
  if (drift.kind === "unmigrated-foreign-project-source") {
    return {
      message: `${toolId}'s marketplace registry (${found.location}) still carries '${found.name}' from another project's pre-migration cache (${found.registeredSource})`,
      fix: { code: "sync-migrate-source" },
    };
  }
  return {
    message: `${toolId}'s marketplace registry (${found.location}) still carries '${found.name}' from this project's own pre-migration cache (${found.registeredSource})`,
    fix: { code: "sync-migrate-source" },
  };
}
