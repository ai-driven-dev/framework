import { shiftDay } from "../stored-usage.js";

/** A span of whole UTC days, both ends included; `null` is open. */
export interface Period {
  readonly from: string | null;
  readonly to: string | null;
}

export type PeriodOutcome =
  | { readonly ok: true; readonly period: Period }
  | { readonly ok: false; readonly message: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** More days than lie between 0000-01-01 and 9999-12-31: a shift past it never names a
 * four-digit day, and one far enough past it leaves what a date can hold. */
const MAX_SHIFT = 3_652_425;

/** The UTC day of an instant, `YYYY-MM-DD`. */
export function dayOf(at: string): string {
  return new Date(at).toISOString().slice(0, 10);
}

export function inPeriod(at: string, period: Period): boolean {
  const day = dayOf(at);
  return (period.from === null || day >= period.from) && (period.to === null || day <= period.to);
}

/** The day `days` after a `YYYY-MM-DD` day, or `null` past what four digits can name, the
 * end of what a date can hold included. */
function shift(day: string, days: number): string | null {
  if (Math.abs(days) > MAX_SHIFT) return null;
  const shifted = shiftDay(day, days);
  return DAY.test(shifted) ? shifted : null;
}

/** The days whose partitions can hold a call of the period, as a test on a `YYYY-MM-DD` day:
 * from the day before `from` to the day after `to`, an open side, or one past four-digit
 * years, staying open. `undefined` when the period has no bound: every partition.
 *
 * One day on each side, because the copies of one call have been observed less than a day
 * apart (of 262,631 real keys, the widest spread is 0.3 h; measured again on 184,502 message
 * ids written more than once, 0.27 h). Under that bound they sit within a calendar day of each
 * other: a call with a copy in the period has all of them in the window, and folds to the same
 * one as a full read would. Outside it, only an unbounded read folds every copy. A call with
 * no request id is never stored (see `isRequestless`). */
export function windowOf(period: Period): ((day: string) => boolean) | undefined {
  if (period.from === null && period.to === null) return undefined;
  const first = period.from === null ? null : shift(period.from, -1);
  const last = period.to === null ? null : shift(period.to, 1);
  return (day) => (first === null || day >= first) && (last === null || day <= last);
}

function isCalendarDay(text: string): boolean {
  const instant = Date.parse(`${text}T00:00:00.000Z`);
  return (
    DAY.test(text) && !Number.isNaN(instant) && dayOf(new Date(instant).toISOString()) === text
  );
}

/** The days a report covers, from what was asked: nothing is every day, `days` is the last
 * n UTC days ending today, and `from`/`to` are calendar days. */
export function periodOf(
  asked: { readonly from?: string; readonly to?: string; readonly days?: string },
  now: Date
): PeriodOutcome {
  if (asked.days !== undefined) {
    if (asked.from !== undefined || asked.to !== undefined) {
      return { ok: false, message: "--days cannot be combined with --from or --to." };
    }
    const days = /^[1-9]\d*$/.test(asked.days) ? Number(asked.days) : 0;
    if (days === 0) return { ok: false, message: "--days takes a positive whole number." };
    const today = dayOf(now.toISOString());
    const first = shift(today, 1 - days);
    if (first === null) {
      return { ok: false, message: "--days reaches before the year 0000: give fewer days." };
    }
    return { ok: true, period: { from: first, to: today } };
  }
  for (const [flag, value] of [
    ["--from", asked.from],
    ["--to", asked.to],
  ] as const) {
    if (value !== undefined && !isCalendarDay(value)) {
      return { ok: false, message: `${flag} takes a day as YYYY-MM-DD.` };
    }
  }
  const { from = null, to = null } = asked;
  if (from !== null && to !== null && from > to) {
    return { ok: false, message: "--from is after --to." };
  }
  return { ok: true, period: { from, to } };
}
