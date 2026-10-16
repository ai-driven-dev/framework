/** The key of the repository's own git config that holds a clone's consent. */
export const CONSENT_KEY = "aidd.telemetry";
/** What a granting key starts with: this version of measurement, then the token of the interval
 * `on` opened. The previous version asked for nothing of this kind, so nobody was ever opted in
 * to this one by what it left behind. */
const CONSENT_PREFIX = "2:";
const GRANTING = /^2:(\S+)$/u;
/** What `off` writes. */
export const CONSENT_WITHDRAWN = "off";

/** The key `on` writes for the interval it opened. */
export function consentValue(token: string): string {
  return `${CONSENT_PREFIX}${token}`;
}

/** The token a key names, `null` when the key grants nothing: only `2:` and a token does. A
 * bare `2`, `off`, another number, or nothing grants nothing. */
export function tokenOfKey(value: string | null): string | null {
  return GRANTING.exec(value ?? "")?.[1] ?? null;
}

export type Consent = "granted" | "absent" | "unreadable";

/** What was found when the clone's consent was looked up. `unreadable`: git itself could not
 * answer, which is neither a yes nor a plain "not asked". */
export type ConsentReading =
  | { readonly kind: "value"; readonly value: string | null }
  | { readonly kind: "unreadable" };

/** A clone's consent read from its own git config, by where the clone lives rather than by a
 * working tree of it. `absent`: nothing is at the clone's path now, which says nothing of
 * whether the clone is coming back (a share not mounted, a folder moved away and back).
 * `replaced`: another directory is at the path, so the clone is not there and never will be. */
export type CloneConsentReading =
  | ConsentReading
  | { readonly kind: "absent" }
  | { readonly kind: "replaced" };

/** What a clone's key says. Only `2:` and a token is a grant, and even that is only the key's
 * word: the interval it names, in the consent log, is what measures. Nothing committed to the
 * work tree is consulted: a file a teammate pulled cannot opt them in. */
export function consentOf(reading: ConsentReading): Consent {
  if (reading.kind === "unreadable") return "unreadable";
  return tokenOfKey(reading.value) === null ? "absent" : "granted";
}

/** `AIDD_TELEMETRY` set to exactly `0` refuses measurement, whatever a clone granted. Reading
 * the environment is the composition root's job; this is only what its value means. */
export function refusedByEnvironment(value: string | undefined): boolean {
  return value === "0";
}
