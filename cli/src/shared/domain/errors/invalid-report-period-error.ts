import { AiddError } from "./aidd-error.js";

/** A report period that cannot be answered; the message says what to give instead. */
export class InvalidReportPeriodError extends AiddError {
  readonly code = "invalid-report-period";
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportPeriodError";
  }
}
