import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";

/** The version of measurement a project opts in to. The previous measurement wrote a bare
 * `enabled: true`, which asks for nothing this version does. */
export const TELEMETRY_CONSENT_VERSION = 2;

export type Consent = "granted" | "absent" | "unreadable";

/** What `.aidd/config.json` says. A file that does not parse is `unreadable`, not `absent`:
 * both store nothing, but only one of them is something a person should be told about. */
export function consentOf(configText: string | null): Consent {
  if (configText === null) return "absent";
  const parsed = tryParseJson(configText);
  const config = parsed.ok ? asPlainObject(parsed.value) : null;
  if (config === null) return "unreadable";
  const telemetry = asPlainObject(config.telemetry);
  return telemetry?.enabled === true && telemetry.version === TELEMETRY_CONSENT_VERSION
    ? "granted"
    : "absent";
}

/** `AIDD_TELEMETRY` set to exactly `0` refuses measurement, whatever a project granted. Reading
 * the environment is the composition root's job; this is only what its value means. */
export function refusedByEnvironment(value: string | undefined): boolean {
  return value === "0";
}
