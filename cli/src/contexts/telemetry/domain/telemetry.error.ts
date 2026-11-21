import { AiddError } from "../../../shared/domain/shared.error.js";
import { MAX_IDENTITY_LENGTH } from "../contract/identity-limit.js";

/** `aidd telemetry on` told to name the person and to name nobody. */
export class ConflictingIdentityFlagsError extends AiddError {
  readonly code = "conflicting-identity-flags";
  constructor() {
    super("--as names you and --anonymous names nobody: give one of them.");
    this.name = "ConflictingIdentityFlagsError";
  }
}

/** `aidd telemetry on --as` given an identifier that cannot name a person. */
export class InvalidIdentityError extends AiddError {
  readonly code = "invalid-identity";
  constructor() {
    super(
      `An identity is one non-empty line of at most ${MAX_IDENTITY_LENGTH} characters. Nothing was changed.`
    );
    this.name = "InvalidIdentityError";
  }
}

/** A report period that cannot be answered; the message says what to give instead. */
export class InvalidReportPeriodError extends AiddError {
  readonly code = "invalid-report-period";
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportPeriodError";
  }
}

/** `aidd telemetry task --none` given a name or a ticket. */
export class TaskDeclaredNoneWithNameError extends AiddError {
  readonly code = "task-declared-none-with-name";
  constructor() {
    super("--none declares no task: give it neither a name nor --ticket.");
    this.name = "TaskDeclaredNoneWithNameError";
  }
}

/** `aidd telemetry task` given neither a name nor `--none`. */
export class TaskNameMissingError extends AiddError {
  readonly code = "task-name-missing";
  constructor() {
    super(
      "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status."
    );
    this.name = "TaskNameMissingError";
  }
}
