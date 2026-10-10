import { tryParseJson } from "../../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import { type CloneIdentity, cloneKey, parseCloneIdentity } from "./clone-identity.js";

/** A line of `consents.jsonl`: an interval opened for a clone by `on`, or closed, by `off`, by
 * an ingest that saw the clone stop consenting, or by a hook that did. `at` is ISO-8601 UTC. */
export type ConsentEvent =
  | {
      readonly kind: "open";
      readonly token: string;
      readonly clone: CloneIdentity;
      readonly at: string;
    }
  | { readonly kind: "close"; readonly token: string; readonly at: string };

/** A stretch of time a clone consented to be measured: `from` included, `to` excluded, `null`
 * while it lasts. The token is the one `on` put in the clone's key. */
export interface ConsentInterval {
  readonly token: string;
  readonly clone: CloneIdentity;
  readonly from: number;
  readonly to: number | null;
}

/** What `consents.jsonl` holds. `damaged`: a line was not exactly an event, so what the file says
 * cannot be trusted and nothing is stored for any clone. */
export interface ConsentRecords {
  readonly events: readonly ConsentEvent[];
  readonly damaged: boolean;
}

export function renderConsentEvent(event: ConsentEvent): string {
  return event.kind === "open"
    ? JSON.stringify({ token: event.token, clone: event.clone, open: event.at })
    : JSON.stringify({ token: event.token, close: event.at });
}

function sameKeys(object: Record<string, unknown>, keys: readonly string[]): boolean {
  const held = Object.keys(object);
  return held.length === keys.length && keys.every((key) => held.includes(key));
}

function instantText(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** A line that is not exactly an event is `null`, never guessed at. */
export function parseConsentEvent(line: string): ConsentEvent | null {
  const parsed = tryParseJson(line);
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  if (object === null) return null;
  const { token } = object;
  if (typeof token !== "string" || !/^\S+$/u.test(token)) return null;
  if (sameKeys(object, ["token", "clone", "open"])) {
    const clone = parseCloneIdentity(object.clone);
    const at = instantText(object.open);
    return clone === null || at === null ? null : { kind: "open", token, clone, at };
  }
  if (sameKeys(object, ["token", "close"])) {
    const at = instantText(object.close);
    return at === null ? null : { kind: "close", token, at };
  }
  return null;
}

/** The events of the file, in the order written. A blank line is not damage; any other line
 * that is not an event is. */
export function parseConsentRecords(text: string | null): ConsentRecords {
  const events: ConsentEvent[] = [];
  let damaged = false;
  for (const line of (text ?? "").split("\n")) {
    if (line.trim() === "") continue;
    const event = parseConsentEvent(line);
    if (event === null) damaged = true;
    else events.push(event);
  }
  return { events, damaged };
}

/** The intervals the events say, in the order they were opened. A token opened twice is its
 * first opening. A token closed more than once, by an ingest and a hook that both saw the key
 * change, ends at the earliest: the file is appended to by several processes, so the order of
 * its lines says nothing about the order of events. A close of a token never opened changes
 * nothing. */
export function foldConsent(events: readonly ConsentEvent[]): ConsentInterval[] {
  const closes = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== "close") continue;
    const at = Date.parse(event.at);
    closes.set(event.token, Math.min(at, closes.get(event.token) ?? at));
  }
  const intervals = new Map<string, ConsentInterval>();
  for (const event of events) {
    if (event.kind !== "open" || intervals.has(event.token)) continue;
    intervals.set(event.token, {
      token: event.token,
      clone: event.clone,
      from: Date.parse(event.at),
      to: closes.get(event.token) ?? null,
    });
  }
  return [...intervals.values()];
}

export function isOpen(interval: ConsentInterval): boolean {
  return interval.to === null;
}

/** Whether one of the clone's intervals covered the instant `at` (milliseconds since the epoch):
 * `on` at T covers a call at T, `off` at T does not. */
export function covers(
  intervals: readonly ConsentInterval[],
  clone: CloneIdentity,
  at: number
): boolean {
  const key = cloneKey(clone);
  return intervals.some(
    (interval) =>
      cloneKey(interval.clone) === key &&
      interval.from <= at &&
      (interval.to === null || at < interval.to)
  );
}
