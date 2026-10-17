import { describe, expect, it } from "vitest";
import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import {
  type ConsentEvent,
  covers,
  foldConsent,
  isOpen,
  parseConsentEvent,
  parseConsentRecords,
  renderConsentEvent,
} from "../../../../src/contexts/telemetry/domain/consent/consent-history.js";

const A: CloneIdentity = { path: "/a/.git", dev: "1", ino: "7", birthtimeMs: 1_000 };
const B: CloneIdentity = { ...A, ino: "8" };
const at = (second: number) => new Date(second * 1000).toISOString();
const open = (token: string, clone: CloneIdentity, second: number): ConsentEvent => ({
  kind: "open",
  token,
  clone,
  at: at(second),
});
const close = (token: string, second: number): ConsentEvent => ({
  kind: "close",
  token,
  at: at(second),
});

describe("what a clone consented to", () => {
  it("covers nothing before its on: measurement starts there", () => {
    const intervals = foldConsent([open("t1", A, 100)]);
    expect(covers(intervals, A, 99_999)).toBe(false);
    expect(covers(intervals, A, 100_000)).toBe(true);
    expect(covers(intervals, A, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(intervals.every(isOpen)).toBe(true);
  });

  it("stops covering at its close: on at T covers T, off at T does not cover T", () => {
    const intervals = foldConsent([open("t1", A, 100), close("t1", 200)]);
    expect(covers(intervals, A, 199_999)).toBe(true);
    expect(covers(intervals, A, 200_000)).toBe(false);
    expect(intervals.some(isOpen)).toBe(false);
  });

  it("covers a later on only from its own time", () => {
    const intervals = foldConsent([open("t1", A, 100), close("t1", 200), open("t2", A, 300)]);
    expect(covers(intervals, A, 50_000)).toBe(false);
    expect(covers(intervals, A, 150_000)).toBe(true);
    expect(covers(intervals, A, 250_000)).toBe(false);
    expect(covers(intervals, A, 300_000)).toBe(true);
  });

  it("opens a token once: the first opening stands", () => {
    const intervals = foldConsent([open("t1", A, 100), open("t1", B, 300), close("t1", 400)]);
    expect(intervals).toEqual([{ token: "t1", clone: A, from: 100_000, to: 400_000 }]);
  });

  it("ends a token at its earliest close, whatever order the lines were written in", () => {
    const intervals = foldConsent([open("t1", A, 100), close("t1", 500), close("t1", 300)]);
    expect(intervals[0]?.to).toBe(300_000);
    expect(foldConsent([close("t1", 300), open("t1", A, 100)])[0]?.to).toBe(300_000);
  });

  it("ignores the close of a token never opened", () => {
    expect(foldConsent([close("t9", 100)])).toEqual([]);
  });

  it("keeps each clone's own intervals, even at one path", () => {
    const intervals = foldConsent([open("t1", A, 100), open("t2", B, 500), close("t1", 600)]);
    expect(covers(intervals, A, 700_000)).toBe(false);
    expect(covers(intervals, B, 700_000)).toBe(true);
  });

  it("does not let a key's token stand for a clone: another clone is not covered by it", () => {
    const intervals = foldConsent([open("t1", A, 100)]);
    expect(covers(intervals, B, 200_000)).toBe(false);
  });

  it("covers nothing for a clone with no interval", () => {
    expect(covers([], A, 1)).toBe(false);
  });
});

describe("an event as the file keeps it", () => {
  it.each([
    ["an open", open("t1", A, 100)],
    ["a close", close("t1", 200)],
  ])("round-trips %s", (_name, event) => {
    expect(parseConsentEvent(renderConsentEvent(event))).toEqual(event);
  });

  it("writes an open as {token, clone, open} and a close as {token, close}", () => {
    expect(JSON.parse(renderConsentEvent(open("t1", A, 100)))).toEqual({
      token: "t1",
      clone: A,
      open: at(100),
    });
    expect(renderConsentEvent(close("t1", 200))).toBe(`{"token":"t1","close":"${at(200)}"}`);
  });

  it.each([
    ["not JSON", "{nope"],
    ["not an object", "[1]"],
    ["no token", JSON.stringify({ clone: A, open: at(1) })],
    ["a token with a space", JSON.stringify({ token: "t 1", clone: A, open: at(1) })],
    ["no clone", JSON.stringify({ token: "t1", open: at(1) })],
    [
      "a clone with no inode",
      JSON.stringify({ token: "t1", clone: { ...A, ino: "0" }, open: at(1) }),
    ],
    ["a time that is no time", JSON.stringify({ token: "t1", clone: A, open: "later" })],
    ["a time that is a number", JSON.stringify({ token: "t1", clone: A, open: 5 })],
    ["a field more", JSON.stringify({ token: "t1", clone: A, open: at(1), extra: 1 })],
    ["an open and a close", JSON.stringify({ token: "t1", open: at(1), close: at(2) })],
    ["a close with no time", JSON.stringify({ token: "t1", close: "yesterday" })],
  ])("is not an event when it holds %s", (_name, line) => {
    expect(parseConsentEvent(line)).toBeNull();
  });
});

describe("the file as a whole", () => {
  const line = (event: ConsentEvent) => `${renderConsentEvent(event)}\n`;

  it("is empty, and sound, when there is no file", () => {
    expect(parseConsentRecords(null)).toEqual({ events: [], damaged: false });
  });

  it("reads its events in order, and does not take blank lines for damage", () => {
    const text = `${line(open("t1", A, 100))}\n  \n${line(close("t1", 200))}`;
    expect(parseConsentRecords(text)).toEqual({
      events: [open("t1", A, 100), close("t1", 200)],
      damaged: false,
    });
  });

  it("is damaged by any line that is not an event, and keeps the events it could read", () => {
    const text = `${line(open("t1", A, 100))}{"token":"t1","clo\n${line(open("t2", B, 300))}`;
    const records = parseConsentRecords(text);
    expect(records.damaged).toBe(true);
    expect(records.events.map((event) => event.token)).toEqual(["t1", "t2"]);
  });
});
