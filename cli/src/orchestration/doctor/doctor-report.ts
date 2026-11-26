import type { AuthenticationIssue } from "../../contexts/auth/contract/authentication-issue.js";
import type { RegistrationIssue } from "../../contexts/host-registration/contract/registration-issue.js";
import type {
  DoctorIssue,
  PluginIssueEntry,
  ToolHealth,
} from "../../contexts/installation/contract/doctor-issue.js";

export type ReportedIssue = DoctorIssue | RegistrationIssue | AuthenticationIssue;

/** What one doctor run found for one tool category. */
export interface DoctorReport {
  healthy: boolean;
  toolHealth: ToolHealth[];
  issues: ReportedIssue[];
  pluginIssues: PluginIssueEntry[];
}
