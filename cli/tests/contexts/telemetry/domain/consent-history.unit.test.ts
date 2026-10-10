import { describe, expect, it } from "vitest";
import {
  type CloneIdentity,
  cloneKey,
} from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import {
  type ConsentEvent,
  covers,
  foldConsent,
  isOpen,
  parseConsentEvent,
  renderConsentEvent,
} from "../../../../src/contexts/telemetry/domain/consent/consent-history.js";

const A: CloneIdentity = { path: "/a/.git", dev: "1", ino: "7", birthtimeMs: 1_000 };
const B: CloneIdentity = { ...A, ino: "8" };
const at = (second: number) => new Date(second * 1000).toISOString();
const event = (clone: CloneIdentity, state: "on" | "off", second: number): ConsentEvent => ({
  clone,
  state,
  at: at(second),
});
const historyOf = (events: ConsentEvent[], clone = A) => foldConsent(events).get(cloneKey(clone));

describe("what a clone consented to", () => {
  it("covers every time before its first on, when it is still on", () => {
    const history = historyOf([event(A, "on", 100)]);
    expect(covers(history, Number.MIN_SAFE_INTEGER)).toBe(true);
    expect(covers(history, 100_000)).toBe(true);
    expect(covers(history, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isOpen(history)).toBe(true);
  });

  it("stops covering at its off: on at T covers T, off at T does not cover T", () => {
    const history = historyOf([event(A, "on", 100), event(A, "off", 200)]);
    expect(covers(history, 199_999)).toBe(true);
    expect(covers(history, 200_000)).toBe(false);
    expect(isOpen(history)).toBe(false);
  });

  it("covers a later on only from its own time, and keeps the first on's backfill", () => {
    const history = historyOf([event(A, "on", 100), event(A, "off", 200), event(A, "on", 300)]);
    expect(covers(history, 50_000)).toBe(true);
    expect(covers(history, 250_000)).toBe(false);
    expect(covers(history, 299_999)).toBe(false);
    expect(covers(history, 300_000)).toBe(true);
    expect(isOpen(history)).toBe(true);
  });

  it("opens once: an on that finds one open changes nothing", () => {
    const history = historyOf([event(A, "on", 100), event(A, "on", 300), event(A, "off", 400)]);
    expect(history?.spans).toEqual([{ from: Number.NEGATIVE_INFINITY, to: 400_000 }]);
  });

  it("closes once: an off that finds none changes nothing", () => {
    const history = historyOf([
      event(A, "off", 100),
      event(A, "on", 200),
      event(A, "off", 300),
      event(A, "off", 400),
    ]);
    expect(history?.spans).toEqual([{ from: Number.NEGATIVE_INFINITY, to: 300_000 }]);
  });

  it("is the first on's, whatever came before it as an off", () => {
    const history = historyOf([event(A, "off", 100), event(A, "on", 200)]);
    expect(covers(history, 150_000)).toBe(true);
  });

  it("keeps each clone's own, even at one path", () => {
    const events = [event(A, "on", 100), event(B, "on", 500), event(A, "off", 600)];
    expect(covers(historyOf(events, A), 700_000)).toBe(false);
    expect(covers(historyOf(events, B), 700_000)).toBe(true);
    expect(foldConsent(events).size).toBe(2);
  });

  it("covers nothing, and is not open, for a clone that only ever had an off", () => {
    const history = historyOf([event(A, "off", 100)]);
    expect(history?.spans).toEqual([]);
    expect(isOpen(history)).toBe(false);
    expect(covers(history, 100_000)).toBe(false);
  });

  it("covers nothing for a clone with no events", () => {
    expect(covers(undefined, 1)).toBe(false);
    expect(isOpen(undefined)).toBe(false);
  });
});

describe("an event as the file keeps it", () => {
  it("round-trips", () => {
    expect(parseConsentEvent(renderConsentEvent(event(A, "on", 100)))).toEqual(event(A, "on", 100));
  });

  it.each([
    ["not JSON", "{nope"],
    ["not an object", "[1]"],
    ["no clone", JSON.stringify({ state: "on", at: at(1) })],
    [
      "a clone with no inode",
      JSON.stringify({ clone: { ...A, ino: "0" }, state: "on", at: at(1) }),
    ],
    ["another state", JSON.stringify({ clone: A, state: "maybe", at: at(1) })],
    ["no time", JSON.stringify({ clone: A, state: "on" })],
    ["a time that is no time", JSON.stringify({ clone: A, state: "on", at: "later" })],
    ["a time that is a number", JSON.stringify({ clone: A, state: "on", at: 5 })],
  ])("is skipped when it holds %s", (_name, line) => {
    expect(parseConsentEvent(line)).toBeNull();
  });
});
