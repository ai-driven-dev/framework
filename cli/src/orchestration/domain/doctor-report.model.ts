import type {
  DoctorIssue,
  PluginIssueEntry,
  ToolHealth,
} from "../../contexts/installation/contract/doctor-issue.js";

/** What one doctor run found for one tool category. */
export interface DoctorReport {
  healthy: boolean;
  toolHealth: ToolHealth[];
  issues: DoctorIssue[];
  pluginIssues: PluginIssueEntry[];
}
