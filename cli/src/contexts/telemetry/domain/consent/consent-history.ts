import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import { type CloneIdentity, cloneKey, parseCloneIdentity } from "./clone-identity.js";

/** One change of a clone's consent, as `on` or `off` made it, or as ingest observed it. */
export interface ConsentEvent {
  readonly clone: CloneIdentity;
  readonly state: "on" | "off";
  /** ISO-8601 UTC. */
  readonly at: string;
}

/** A stretch of time a clone consented to be measured: `from` included, `to` excluded, `null`
 * while it lasts. */
export interface ConsentSpan {
  readonly from: number;
  readonly to: number | null;
}

export interface CloneConsentHistory {
  readonly clone: CloneIdentity;
  readonly spans: readonly ConsentSpan[];
}

export function renderConsentEvent(event: ConsentEvent): string {
  return JSON.stringify({ clone: event.clone, state: event.state, at: event.at });
}

/** A line that is not exactly an event is skipped, never guessed at. */
export function parseConsentEvent(line: string): ConsentEvent | null {
  const parsed = tryParseJson(line);
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  if (object === null) return null;
  const clone = parseCloneIdentity(object.clone);
  if (clone === null) return null;
  if (object.state !== "on" && object.state !== "off") return null;
  if (typeof object.at !== "string" || Number.isNaN(Date.parse(object.at))) return null;
  return { clone, state: object.state, at: object.at };
}

/** What each clone consented to, from the events in the order they were written. The first
 * `on` of a clone opens at the start of its history, so it covers the calls made before it; an
 * `on` after an `off` opens at its own time. An `on` that finds one open, and an `off` that
 * finds none, change nothing. */
export function foldConsent(
  events: readonly ConsentEvent[]
): ReadonlyMap<string, CloneConsentHistory> {
  const histories = new Map<string, { clone: CloneIdentity; spans: ConsentSpan[] }>();
  for (const event of events) {
    const key = cloneKey(event.clone);
    const held = histories.get(key) ?? { clone: event.clone, spans: [] };
    histories.set(key, held);
    const last = held.spans.at(-1);
    const instant = Date.parse(event.at);
    if (last !== undefined && last.to === null) {
      if (event.state === "off")
        held.spans[held.spans.length - 1] = { from: last.from, to: instant };
    } else if (event.state === "on") {
      held.spans.push({ from: last === undefined ? Number.NEGATIVE_INFINITY : instant, to: null });
    }
  }
  return histories;
}

export function isOpen(history: CloneConsentHistory | undefined): boolean {
  return history?.spans.at(-1)?.to === null;
}

/** Whether a clone's consent covered the instant `at` (milliseconds since the epoch). */
export function covers(history: CloneConsentHistory | undefined, at: number): boolean {
  return (
    history?.spans.some((span) => span.from <= at && (span.to === null || at < span.to)) ?? false
  );
}
