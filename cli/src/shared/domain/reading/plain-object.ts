import { tryParseJson } from "./json-file.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrows a value fresh out of `JSON.parse` to a plain object, `null` for anything else -
 * an array, a primitive, or `null` itself. */
export function asPlainObject(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/** The plain object JSON `text` holds, `null` for anything else. */
export function plainObjectIn(text: string | null): Record<string, unknown> | null {
  const parsed = tryParseJson(text);
  return parsed.ok ? asPlainObject(parsed.value) : null;
}
