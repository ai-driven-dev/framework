import type { RegistrationIssue } from "../../contexts/host-registration/contract/registration-issue.js";
import type {
  DoctorIssue,
  PluginIssueEntry,
  ToolHealth,
} from "../../contexts/installation/contract/doctor-issue.js";

/** An issue of any doctor check. */
export type ReportedIssue = DoctorIssue | RegistrationIssue;

/** What one doctor run found for one tool category. */
export interface DoctorReport {
  healthy: boolean;
  toolHealth: ToolHealth[];
  issues: ReportedIssue[];
  pluginIssues: PluginIssueEntry[];
}
