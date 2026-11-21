import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

export type IssueSeverity = "info" | "warning" | "error";

/** What a person does about an issue: a sentence naming no command, or a code and its facts that
 * presentation words. */
export type DoctorFix =
  | { readonly code: "remove-or-track-directory" }
  | { readonly code: "restore-or-sync" }
  | {
      readonly code: "sync-force";
      readonly effect: "reinstall-files" | "revert-file" | "restore-keys" | "restore-value";
    }
  | { readonly code: "sync-reregister" }
  | { readonly code: "sync-migrate-source" }
  | { readonly code: "update-cli" }
  | { readonly code: "authenticate" }
  | { readonly code: "install-framework"; readonly tool: string }
  | { readonly code: "replace-conflicting-source"; readonly name: string }
  | { readonly code: "refresh-marketplace"; readonly file: string };

export interface DoctorIssue {
  severity: IssueSeverity;
  message: string;
  fix: string | DoctorFix;
}

export interface ToolHealth {
  toolId: ToolId;
  fileCount: number;
  mergeFileCount: number;
}

export type PluginIssueKind = "missing" | "hash-mismatch" | "not-installed-on-machine";

export interface PluginIssueEntry {
  toolId: AiToolId;
  pluginName: string;
  issue: PluginIssueKind;
  /** Absent for `not-installed-on-machine`: the fact is one line for the whole
   * plugin, not one path per tracked file. */
  filePath?: string;
}

export interface DoctorReport {
  healthy: boolean;
  toolHealth: ToolHealth[];
  issues: DoctorIssue[];
  pluginIssues: PluginIssueEntry[];
}
