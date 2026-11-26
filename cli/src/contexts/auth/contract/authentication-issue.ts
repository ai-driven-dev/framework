import type { IssueSeverity } from "../../../shared/domain/issue/issue-severity.js";

/** What a person does about a missing authentication: a code that presentation words. */
export interface AuthenticationFix {
  readonly code: "authenticate";
}

/** A missing authentication as the issue a person reads. */
export interface AuthenticationIssue {
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly fix: AuthenticationFix;
}
