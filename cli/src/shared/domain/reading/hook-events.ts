import { asPlainObject } from "./plain-object.js";

/** The events a plugin's `hooks.json` declares, none when it declares no `hooks` object. */
export function hookEventsOf(json: string): Readonly<Record<string, unknown>> {
  return asPlainObject(asPlainObject(JSON.parse(json))?.hooks) ?? {};
}
