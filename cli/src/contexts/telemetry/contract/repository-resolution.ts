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
