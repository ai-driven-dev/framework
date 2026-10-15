import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { stripJsonComments } from "../../../../kernel/reading/jsonc.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";

/** How long Claude Code keeps a transcript before deleting it, which is how far back a report
 * can read. */
export const RETENTION_WANTED_DAYS = 3650;
/** What Claude Code keeps them for when no settings file says otherwise. */
export const RETENTION_DEFAULT_DAYS = 30;

function daysIn(text: string | null): number | null {
  if (text === null) return null;
  const parsed = tryParseJson(stripJsonComments(text));
  const value = parsed.ok ? asPlainObject(parsed.value)?.cleanupPeriodDays : undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** The first settings text that sets `cleanupPeriodDays` wins, so they are given the way
 * Claude Code ranks them: the project's local file, the project's shared file, then the user's. */
export function effectiveRetentionDays(texts: readonly (string | null)[]): number {
  for (const text of texts) {
    const days = daysIn(text);
    if (days !== null) return days;
  }
  return RETENTION_DEFAULT_DAYS;
}

export function retentionShort(days: number): boolean {
  return days < RETENTION_WANTED_DAYS;
}
