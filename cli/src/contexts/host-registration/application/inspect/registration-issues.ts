import type { AiToolId } from "../../../../shared/domain/tool.js";
import type {
  UndeclaredMarketplace,
  UnparseableSettings,
} from "../../contract/inspect-declared-marketplaces-result.js";
import type { RegistrationIssue } from "../../contract/registration-issue.js";
import type { MarketplaceSourceDriftFound } from "../../domain/source/marketplace-source-drift.js";
import type { HostRegistrationFinding } from "./inspect-host-registration-result.js";

type Severity = RegistrationIssue["severity"];

/** A settings file that cannot be read, or whose declarations drifted from the project, is never a fault that blocks anything. */
const SETTINGS_DECLARATION_SEVERITY: Severity = "warning";

/** How serious a host registry finding is. An unanswered registry or an unrecorded marketplace is
 * information; a drift is a `warning`, never an `error`, since the project did not cause it and it
 * blocks nothing; a missing or disabled plugin and a different-catalog conflict are errors. */
function findingSeverity(finding: HostRegistrationFinding): Severity {
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

/** Words a host registry finding as the issue a person reads. */
export function registrationIssueOf(finding: HostRegistrationFinding): RegistrationIssue {
  return { severity: findingSeverity(finding), ...wordingOf(finding) };
}

/** A tool's settings file that exists but cannot be read as a settings object. */
export function unparseableSettingsIssue(file: UnparseableSettings): RegistrationIssue {
  return {
    severity: SETTINGS_DECLARATION_SEVERITY,
    message: `${file.tool}: ${file.file} cannot be parsed (${file.reason})`,
    fix: { code: "repair-settings-file", file: file.file },
  };
}

/** A marketplace the project registers that a tool's settings file no longer declares. */
export function undeclaredMarketplaceIssue(found: UndeclaredMarketplace): RegistrationIssue {
  return {
    severity: SETTINGS_DECLARATION_SEVERITY,
    message: `${found.tool} no longer declares marketplace '${found.name}'`,
    fix: { code: "refresh-marketplace", file: found.file },
  };
}

/** A declaration left in a tool's settings file for a marketplace the project no longer registers. */
export function staleDeclarationIssue(entry: UndeclaredMarketplace): RegistrationIssue {
  return {
    severity: SETTINGS_DECLARATION_SEVERITY,
    message: `${entry.tool} still declares marketplace '${entry.name}', which this project no longer registers`,
    fix: { code: "remove-stale-declaration", name: entry.name, file: entry.file },
  };
}

function wordingOf(finding: HostRegistrationFinding): Pick<RegistrationIssue, "message" | "fix"> {
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
    case "source-conflict":
      return {
        message: `${tool}'s marketplace registry (${finding.location}) carries '${finding.name}' from a different catalog (${finding.registeredSource}) than this project's own (${finding.requestedSource}) — plugins ${finding.pluginDiff}`,
        fix: { code: "replace-conflicting-source", name: finding.name },
      };
  }
}

function driftIssue(
  toolId: AiToolId,
  found: MarketplaceSourceDriftFound
): Pick<RegistrationIssue, "message" | "fix"> {
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
