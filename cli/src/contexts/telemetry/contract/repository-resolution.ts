/** Why a billed call was read and not stored. `consent-closed`: the clone's live key names an
 * interval that was closed, so it did opt in once and can again; `no-consent` is a clone that
 * never did. */
export type NotStoredReason =
  | "outside-repo"
  | "never-seen-alive"
  | "no-consent"
  | "consent-closed"
  | "unreadable-consent"
  | "no-cwd"
  | "undated";

/** What is measured and cannot be stored: a call with no usable time, a transcript line that is
 * no usage line, a call with no request id. Only of a clone that consents, at the time of the
 * thing or, with none, of the read: a clone that never opted in, or work after `off`, leaves
 * nothing here. */
export type LeftOutReason = "undated" | "unrecognised" | "requestless";
