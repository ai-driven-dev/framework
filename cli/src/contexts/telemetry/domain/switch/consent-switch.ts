import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import { TELEMETRY_CONSENT_VERSION } from "../telemetry-consent.js";

export type Switched =
  | { readonly status: "unreadable" }
  /** The file already says what was asked, or has nothing to say it in. */
  | { readonly status: "unchanged" }
  | { readonly status: "switched"; readonly text: string };

function render(config: Record<string, unknown>): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** A config that does not parse is never rewritten: what it holds cannot be kept. */
function configOf(text: string): Record<string, unknown> | null {
  const parsed = tryParseJson(text);
  return parsed.ok ? asPlainObject(parsed.value) : null;
}

/** `.aidd/config.json` with measurement granted at this version. Every other key stays, and so
 * does everything else the `telemetry` key holds. */
export function switchedOn(text: string | null): Switched {
  const config = text === null ? {} : configOf(text);
  if (config === null) return { status: "unreadable" };
  const telemetry = asPlainObject(config.telemetry) ?? {};
  if (telemetry.enabled === true && telemetry.version === TELEMETRY_CONSENT_VERSION) {
    return { status: "unchanged" };
  }
  return {
    status: "switched",
    text: render({
      ...config,
      telemetry: { ...telemetry, enabled: true, version: TELEMETRY_CONSENT_VERSION },
    }),
  };
}

/** `.aidd/config.json` with measurement stopped. The version stays: it records which
 * measurement was asked for, not whether it is wanted. */
export function switchedOff(text: string | null): Switched {
  if (text === null) return { status: "unchanged" };
  const config = configOf(text);
  if (config === null) return { status: "unreadable" };
  const telemetry = asPlainObject(config.telemetry);
  if (telemetry === null || telemetry.enabled === false) return { status: "unchanged" };
  return {
    status: "switched",
    text: render({ ...config, telemetry: { ...telemetry, enabled: false } }),
  };
}
