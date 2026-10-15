/** A span of whole UTC days, both ends included; `null` is open. */
export interface Period {
  readonly from: string | null;
  readonly to: string | null;
}

export type PeriodOutcome =
  | { readonly ok: true; readonly period: Period }
  | { readonly ok: false; readonly message: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** The UTC day of an instant, `YYYY-MM-DD`. */
export function dayOf(at: string): string {
  return new Date(at).toISOString().slice(0, 10);
}

export function inPeriod(at: string, period: Period): boolean {
  const day = dayOf(at);
  return (period.from === null || day >= period.from) && (period.to === null || day <= period.to);
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
    const first = dayOf(
      new Date(Date.parse(`${today}T00:00:00.000Z`) - (days - 1) * DAY_MS).toISOString()
    );
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
