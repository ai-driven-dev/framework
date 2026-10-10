/** The key of the repository's own git config that holds a clone's consent. */
export const CONSENT_KEY = "aidd.telemetry";
/** The one value that is consent: this version of measurement. The previous version asked for
 * nothing of this kind, so nobody was ever opted in to this one by what it left behind. */
export const CONSENT_GRANTED = "2";
/** What `off` writes. */
export const CONSENT_WITHDRAWN = "off";

export type Consent = "granted" | "absent" | "unreadable";

/** What was found when the clone's consent was looked up. `unreadable`: git itself could not
 * answer, which is neither a yes nor a plain "not asked". */
export type ConsentReading =
  | { readonly kind: "value"; readonly value: string | null }
  | { readonly kind: "unreadable" };

/** What a clone's consent means. Only the exact value `2` grants; `off`, another number or
 * nothing at all grant nothing. Nothing committed to the work tree is consulted: a file a
 * teammate pulled cannot opt them in. */
export function consentOf(reading: ConsentReading): Consent {
  if (reading.kind === "unreadable") return "unreadable";
  return reading.value === CONSENT_GRANTED ? "granted" : "absent";
}

/** `AIDD_TELEMETRY` set to exactly `0` refuses measurement, whatever a clone granted. Reading
 * the environment is the composition root's job; this is only what its value means. */
export function refusedByEnvironment(value: string | undefined): boolean {
  return value === "0";
}
