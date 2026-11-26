import { describe, expect, it } from "vitest";
import {
  type ConsentEvent,
  closeEvent,
  openEvent,
} from "../../../../../src/contexts/telemetry/domain/consent/consent-history.js";
import { ConsentLog } from "../../../../../src/contexts/telemetry/domain/consent/consent-log.js";
import { cloneOf } from "../../testing/clone.builder.js";

const A = cloneOf("/a/.git");
const B = cloneOf("/a/.git", { ino: "9" });
const T1 = new Date("2026-10-01T00:00:00.000Z");
const T2 = new Date("2026-10-02T00:00:00.000Z");
const T3 = new Date("2026-10-03T00:00:00.000Z");

const logOf = (...events: ConsentEvent[]): ConsentLog => new ConsentLog({ events, damaged: false });

describe("when each clone consented, as the history says", () => {
  it("names the clone and the token on the event that opens an interval, and the token alone on the one that closes it", () => {
    expect(openEvent(A, "t1", T1)).toEqual({
      kind: "open",
      token: "t1",
      clone: A,
      at: T1.toISOString(),
    });
    expect(closeEvent("t1", T2)).toEqual({ kind: "close", token: "t1", at: T2.toISOString() });
  });

  it("covers a call from the moment it opens to the moment it closes", () => {
    const open = logOf(openEvent(A, "t1", T2));
    expect(open.covers(A, T1.getTime())).toBe(false);
    expect(open.covers(A, T2.getTime())).toBe(true);
    const closed = logOf(openEvent(A, "t1", T2), closeEvent("t1", T3));
    expect(closed.covers(A, T3.getTime() - 1)).toBe(true);
    expect(closed.covers(A, T3.getTime())).toBe(false);
  });

  it("opens a later on only from its own time", () => {
    const log = logOf(openEvent(A, "t1", T1), closeEvent("t1", T2), openEvent(A, "t2", T3));
    expect(log.covers(A, T1.getTime() - 1)).toBe(false);
    expect(log.covers(A, T2.getTime())).toBe(false);
    expect(log.covers(A, T3.getTime() - 1)).toBe(false);
    expect(log.covers(A, T3.getTime())).toBe(true);
  });

  it("lists the intervals still open, and only those, of a clone or of all", () => {
    const log = logOf(openEvent(A, "t1", T1), openEvent(B, "t2", T1), closeEvent("t1", T2));
    expect(log.openIntervals().map((interval) => interval.token)).toEqual(["t2"]);
    expect(log.openFor(A)).toEqual([]);
    expect(log.openFor(B).map((interval) => interval.token)).toEqual(["t2"]);
  });

  it("knows an interval of the clone that was closed, and not one that is open or another's", () => {
    const log = logOf(openEvent(A, "t1", T1), closeEvent("t1", T2), openEvent(A, "t2", T3));
    expect(log.hasClosed(A, "t1")).toBe(true);
    expect(log.hasClosed(A, "t2")).toBe(false);
    expect(log.hasClosed(B, "t1")).toBe(false);
  });

  it("starts at the earliest opening, and at infinity when no clone ever opted in", () => {
    expect(logOf(openEvent(A, "t1", T2), openEvent(B, "t2", T1)).firstOpened()).toBe(T1.getTime());
    expect(logOf().firstOpened()).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps two clones of one path apart", () => {
    const log = logOf(openEvent(A, "t1", T1));
    expect(log.covers(B, T2.getTime())).toBe(false);
    expect(log.covers(A, T3.getTime())).toBe(true);
  });

  it("says when the file it read was damaged", () => {
    expect(new ConsentLog({ events: [], damaged: true }).damaged).toBe(true);
    expect(logOf().damaged).toBe(false);
  });
});
