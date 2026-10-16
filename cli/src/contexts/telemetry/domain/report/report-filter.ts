import type { StoredUsage } from "../stored-usage.js";
import { compareText } from "../text-order.js";
import { type Attribution, UNATTRIBUTED_REASONS } from "./attribution.js";
import { type AxisValue, axisValueOf, type ReportAxis } from "./usage-report.js";

/** The axes a call can have no value for: no model said, no identity set, a task declared
 * without a ticket. `session`, `agent` and `repository` always have one, and work with no task
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
};

const FLAGS = Object.keys(NO_FILTERS) as FilterFlag[];

/** What a flag asks an axis to be: a row's value, or work with no task for either reason. */
export type Selector = AxisValue | { readonly kind: "unattributed-any" };

/** The axes a flag selects on. Work with no task has neither task nor ticket, so
 * `--unattributed` selects on both. */
function axesOf(filters: ReportFilters, flag: FilterFlag): readonly ReportAxis[] {
  if (filters[flag] === null) return [];
  if (flag === "absent") return [filters[flag] as AbsentAxis];
  return flag === "unattributed" ? ["task", "ticket"] : [flag];
}

/** Pairs of flags given that select on the same axis, in the order the flags are printed:
 * two selectors on one axis keep nothing, so they are refused rather than answered. */
export function conflictsOf(filters: ReportFilters): (readonly [FilterFlag, FilterFlag])[] {
  return FLAGS.flatMap((flag, index) =>
    FLAGS.slice(index + 1)
      .filter((other) =>
        axesOf(filters, flag).some((axis) => axesOf(filters, other).includes(axis))
      )
      .map((other) => [flag, other] as const)
  );
}

/** What each flag given asks the call's axis to be, as a row of that axis holds it, in the
 * order the flags are printed. An unattributed call is unattributed on task and ticket alike,
 * so its task alone is asked. */
export function selectorsOf(filters: ReportFilters): (readonly [ReportAxis, Selector])[] {
  const selectors: (readonly [ReportAxis, Selector])[] = FILTER_AXES.flatMap((axis) => {
    const value = filters[axis];
    return value === null ? [] : [[axis, { kind: "value", value }] as const];
  });
  if (filters.absent !== null) selectors.push([filters.absent, { kind: "absent" }]);
  if (filters.unattributed === "any") selectors.push(["task", { kind: "unattributed-any" }]);
  else if (filters.unattributed !== null) {
    selectors.push(["task", { kind: "unattributed", reason: filters.unattributed }]);
  }
  return selectors;
}

function selects(selector: Selector, value: AxisValue): boolean {
  switch (selector.kind) {
    case "value":
      return value.kind === "value" && value.value === selector.value;
    case "absent":
      return value.kind === "absent";
    case "unattributed":
      return value.kind === "unattributed" && value.reason === selector.reason;
    case "unattributed-any":
      return value.kind === "unattributed";
  }
}

/** Whether every flag given keeps the call: its axis is, by the function that builds the rows,
 * exactly what the flag names. A filter and a row cannot then disagree on a call. */
export function matchesFilter(
  filters: ReportFilters,
  record: StoredUsage,
  attribution: Attribution,
  person: string | null
): boolean {
  return selectorsOf(filters).every(([axis, selector]) =>
    selects(selector, axisValueOf(axis, record, attribution, person))
  );
}

export type ResolvedId =
  | { readonly kind: "found"; readonly id: string }
  | { readonly kind: "ambiguous"; readonly ids: readonly string[] }
  | { readonly kind: "none" };

/** An id typed in full or by its start, among the values an axis has: the value equal to it,
 * else the one value it starts. */
export function resolveId(typed: string, values: Iterable<string>): ResolvedId {
  const known = new Set(values);
  if (known.has(typed)) return { kind: "found", id: typed };
  const ids = [...known].filter((id) => id.startsWith(typed)).sort(compareText);
  if (ids.length === 0) return { kind: "none" };
  return ids.length === 1 ? { kind: "found", id: ids[0] as string } : { kind: "ambiguous", ids };
}
