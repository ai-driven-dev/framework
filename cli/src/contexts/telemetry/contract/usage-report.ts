/** Why a billed call has no task. A call from outside any repository, or from a directory never
 * seen alive, is never stored, so it reaches a report only as a count in `run.not_stored`
 * and is not a reason here. */
export const UNATTRIBUTED_REASONS = ["no-binding", "declared-none"] as const;
export type UnattributedReason = (typeof UNATTRIBUTED_REASONS)[number];

export const REPORT_AXES = [
  "total",
  "person",
  "session",
  "model",
  "agent",
  "day",
  "repository",
  "task",
  "ticket",
  "tool",
] as const;
export type ReportAxis = (typeof REPORT_AXES)[number];

export const COUNTERS = ["input", "output", "cache_read", "cache_write"] as const;
export type Counter = (typeof COUNTERS)[number];

export interface CounterSum {
  readonly known: number;
  readonly unknownRecords: number;
}

export type AxisValue =
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "unattributed"; readonly reason: UnattributedReason }
  | { readonly kind: "absent" };

export interface Tally {
  readonly records: number;
  readonly counters: Readonly<Record<Counter, CounterSum>>;
  readonly total: CounterSum;
}

export interface ReportRow extends Tally {
  readonly value: AxisValue;
}

export interface UsageReport {
  readonly axis: ReportAxis;
  readonly rows: readonly ReportRow[];
  readonly totals: Tally;
}
