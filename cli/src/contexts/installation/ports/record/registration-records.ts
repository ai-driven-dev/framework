/**
 * What is recorded for a tool's host registration, as it came. The record is opaque here: host
 * registration reads its host data and machine claims the claims block it keeps beside it, so
 * installation reads, checks and reorders nothing on the way in or out.
 *
 * Limit: a hand-edited record keeps what the host's rewrites pass through. Every host read goes
 * through `validProvenance`, so nothing invalid is acted on. A rewrite through the host codec
 * normalizes: `withoutMarketplace` drops entry-level unknown keys and invalid provenance but keeps
 * the top-level keys, and `afterActivation` and `mergeCatalogueClaims` drop all of it. A
 * pass-through rewrite (`withoutRef`) keeps unknown keys and invalid provenance as they came. No
 * record has been seen to hold either.
 */
export type RegistrationRecordData = Readonly<Record<string, unknown>>;

/** A claim on a native ref, with the project roots still holding it. */
export interface NativeRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}
