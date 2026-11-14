import { type AxisValue, UNATTRIBUTED_REASONS } from "./usage-report.js";

/** The axes a call can have no value for: no model said, no identity set, a task declared
 * without a ticket. `session`, `agent`, `tool` and `repository` always have one, and work with no task
 * is unattributed, not absent. */
export const ABSENT_AXES = ["person", "model", "ticket"] as const;
export type AbsentAxis = (typeof ABSENT_AXES)[number];

/** The axes a flag names a value of. `day` is selected by the period, `total` by no filter. */
export const FILTER_AXES = [
  "task",
  "ticket",
  "person",
  "model",
  "agent",
  "session",
  "repository",
  "tool",
] as const;
export type FilterAxis = (typeof FILTER_AXES)[number];

/** `--unattributed`: one reason, or either. */
export const UNATTRIBUTED_SELECTORS = [...UNATTRIBUTED_REASONS, "any"] as const;
export type UnattributedSelector = (typeof UNATTRIBUTED_SELECTORS)[number];

/** What a report is narrowed to, one key per flag, in the order the envelope prints them;
 * `null` when the flag is not given. A call is kept when every flag given selects it. */
export interface ReportFilters extends Readonly<Record<FilterAxis, string | null>> {
  readonly absent: AbsentAxis | null;
  readonly unattributed: UnattributedSelector | null;
}
export type FilterFlag = keyof ReportFilters;

export const NO_FILTERS: ReportFilters = {
  task: null,
  ticket: null,
  person: null,
  model: null,
  agent: null,
  session: null,
  repository: null,
  absent: null,
  unattributed: null,
  tool: null,
};

export const FILTER_FLAGS = Object.keys(NO_FILTERS) as FilterFlag[];

/** What a flag asks an axis to be: a row's value, or work with no task for either reason. */
export type Selector = AxisValue | { readonly kind: "unattributed-any" };
