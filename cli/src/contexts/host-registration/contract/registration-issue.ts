import type { IssueSeverity } from "../../../shared/domain/issue/issue-severity.js";

/** What a person does about a registration issue: a sentence naming no command, or a code and its
 * facts that presentation words. */
export type RegistrationFix =
  | { readonly code: "sync-reregister" }
  | { readonly code: "sync-migrate-source" }
  | { readonly code: "update-cli" }
  | { readonly code: "install-framework"; readonly tool: string }
  | { readonly code: "replace-conflicting-source"; readonly name: string }
  | { readonly code: "refresh-marketplace"; readonly file: string }
  | { readonly code: "repair-settings-file"; readonly file: string }
  | { readonly code: "remove-stale-declaration"; readonly name: string; readonly file: string };

/** A host registration finding as the issue a person reads. */
export interface RegistrationIssue {
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly fix: string | RegistrationFix;
}
