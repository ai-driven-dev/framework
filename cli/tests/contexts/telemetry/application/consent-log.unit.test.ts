import { describe, expect, it } from "vitest";
import { ConsentLog } from "../../../../src/contexts/telemetry/application/consent-log.js";
import { cloneOf, InMemoryConsentHistory } from "../../../helpers/ports/in-memory-telemetry.js";

const A = cloneOf("/a/.git");
const B = cloneOf("/a/.git", { ino: "9" });
const T1 = new Date("2026-10-01T00:00:00.000Z");
const T2 = new Date("2026-10-02T00:00:00.000Z");
const T3 = new Date("2026-10-03T00:00:00.000Z");

describe("when each clone consented, as the file keeps it", () => {
  it("writes an open line at the time it opens, naming the clone and the token", async () => {
    const history = new InMemoryConsentHistory();
    const log = await ConsentLog.load(history);
    await log.open(A, "t1", T1);
    expect(history.written).toEqual([
      { kind: "open", token: "t1", clone: A, at: T1.toISOString() },
    ]);
  });

  it("writes a close line at the time it closes, and nothing for a token that is not open", async () => {
    const history = new InMemoryConsentHistory();
    const log = await ConsentLog.load(history);
    await log.close("t1", T1);
    expect(history.written).toEqual([]);
    await log.open(A, "t1", T1);
    await log.close("t1", T2);
    await log.close("t1", T3);
    expect(history.written.map((event) => event.kind)).toEqual(["open", "close"]);
    expect(history.written[1]).toEqual({ kind: "close", token: "t1", at: T2.toISOString() });
  });

  it("answers from what it wrote as it goes, and from what was there when it was loaded", async () => {
    const history = new InMemoryConsentHistory();
    const log = await ConsentLog.load(history);
    expect(log.covers(A, T2.getTime())).toBe(false);
    await log.open(A, "t1", T2);
    expect(log.covers(A, T1.getTime())).toBe(false);
    expect(log.covers(A, T2.getTime())).toBe(true);
    await log.close("t1", T3);
    expect(log.covers(A, T3.getTime())).toBe(false);
    const again = await ConsentLog.load(history);
    expect(again.covers(A, T2.getTime())).toBe(true);
    expect(again.covers(A, T3.getTime())).toBe(false);
  });

  it("opens a later on only from its own time", async () => {
    const log = await ConsentLog.load(new InMemoryConsentHistory());
    await log.open(A, "t1", T1);
    await log.close("t1", T2);
    await log.open(A, "t2", T3);
    expect(log.covers(A, T1.getTime() - 1)).toBe(false);
    expect(log.covers(A, T2.getTime())).toBe(false);
    expect(log.covers(A, T3.getTime() - 1)).toBe(false);
    expect(log.covers(A, T3.getTime())).toBe(true);
  });

  it("lists the intervals still open, and only those, of a clone or of all", async () => {
    const log = await ConsentLog.load(new InMemoryConsentHistory());
    await log.open(A, "t1", T1);
    await log.open(B, "t2", T1);
    await log.close("t1", T2);
    expect(log.openIntervals().map((interval) => interval.token)).toEqual(["t2"]);
    expect(log.openFor(A)).toEqual([]);
    expect(log.openFor(B).map((interval) => interval.token)).toEqual(["t2"]);
  });

  it("keeps two clones of one path apart", async () => {
    const log = await ConsentLog.load(new InMemoryConsentHistory());
    await log.open(A, "t1", T1);
    expect(log.covers(B, T2.getTime())).toBe(false);
    expect(log.covers(A, T3.getTime())).toBe(true);
  });

  it("says when the file it read was damaged", async () => {
    const history = new InMemoryConsentHistory();
    history.damaged = true;
    expect((await ConsentLog.load(history)).damaged).toBe(true);
    expect((await ConsentLog.load(new InMemoryConsentHistory())).damaged).toBe(false);
  });
});
