/** A span of whole UTC days, both ends included; `null` is open. */
export interface Period {
  readonly from: string | null;
  readonly to: string | null;
}

export type PeriodOutcome =
  | { readonly ok: true; readonly period: Period }
  | { readonly ok: false; readonly message: string };
