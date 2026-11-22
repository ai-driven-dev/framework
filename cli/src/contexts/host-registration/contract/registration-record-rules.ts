import type { RegistrationRecordView } from "./claims-view.js";

/** What the host registration answers over a record another context keeps for it, without that
 * context reading the record's shape. */
export interface RegistrationRecordRules {
  /** The ref a plugin has on the host, `undefined` when nothing was recorded for the alias. */
  readonly refOf: (
    record: RegistrationRecordView | undefined,
    plugin: string,
    alias: string | undefined
  ) => string | undefined;
  /** The record without one ref, every other entry untouched. */
  readonly withoutRef: <R extends RegistrationRecordView>(record: R, ref: string) => R;
}
