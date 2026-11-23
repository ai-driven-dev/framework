import { AiddError } from "../../../../shared/domain/shared.error.js";

/** `aidd telemetry on` told to name the person and to name nobody. */
export class ConflictingIdentityFlagsError extends AiddError {
  readonly code = "conflicting-identity-flags";
}

/** `aidd telemetry identity --off` given an identifier to set. */
export class IdentityOffWithIdentifierError extends AiddError {
  readonly code = "identity-off-with-identifier";
}

/** `aidd telemetry on --as` given an identifier that cannot name a person. */
export class InvalidIdentityError extends AiddError {
  readonly code = "invalid-identity";
}

/** A report period that cannot be answered; the detail says what to give instead. */
export class InvalidReportPeriodError extends AiddError {
  readonly code = "invalid-report-period";
  constructor(readonly detail: string) {
    super();
  }
}

/** `aidd telemetry task --none` given a name or a ticket. */
export class TaskDeclaredNoneWithNameError extends AiddError {
  readonly code = "task-declared-none-with-name";
}

/** `aidd telemetry task` given neither a name nor `--none`. */
export class TaskNameMissingError extends AiddError {
  readonly code = "task-name-missing";
}

/** A stream that decompressed to another size than its frame declares. */
export class FrameSizeMismatch extends Error {}
