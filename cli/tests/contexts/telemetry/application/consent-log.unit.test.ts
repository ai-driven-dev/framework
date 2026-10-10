import { describe, expect, it } from "vitest";
import { ConsentLog } from "../../../../src/contexts/telemetry/application/consent-log.js";
import { cloneOf, InMemoryConsentHistory } from "../../../helpers/ports/in-memory-telemetry.js";

const A = cloneOf("/a/.git");
const B = cloneOf("/a/.git", { ino: "9" });
const T1 = new Date("2026-10-01T00:00:00.000Z");
const T2 = new Date("2026-10-02T00:00:00.000Z");
const T3 = new Date("2026-10-03T00:00:00.000Z");

describe("when each clone consented, as the file keeps it", () => {
  it("writes an on at the time it opens, and nothing for an on that finds one open", async () => {
    const history = new InMemoryConsentHistory();
    const log = await ConsentLog.load(history);
    await log.open(A, T1);
    await log.open(A, T2);
    expect(history.written).toEqual([{ clone: A, state: "on", at: T1.toISOString() }]);
  });

  it("writes an off at the time it closes, and nothing for an off that finds none", async () => {
    const history = new InMemoryConsentHistory();
    const log = await ConsentLog.load(history);
    await log.close(A, T1);
    expect(history.written).toEqual([]);
    await log.open(A, T1);
    await log.close(A, T2);
    await log.close(A, T3);
    expect(history.written.map((event) => event.state)).toEqual(["on", "off"]);
  });

  it("answers from what it wrote as it goes, and from what was there when it was loaded", async () => {
    const history = new InMemoryConsentHistory();
    const log = await ConsentLog.load(history);
    expect(log.covers(A, T1.getTime())).toBe(false);
    await log.open(A, T2);
    expect(log.covers(A, T1.getTime())).toBe(true);
    await log.close(A, T3);
    expect(log.covers(A, T3.getTime())).toBe(false);
    const again = await ConsentLog.load(history);
    expect(again.covers(A, T2.getTime())).toBe(true);
    expect(again.covers(A, T3.getTime())).toBe(false);
  });

  it("opens a later on only from its own time", async () => {
    const log = await ConsentLog.load(new InMemoryConsentHistory());
    await log.open(A, T1);
    await log.close(A, T2);
    await log.open(A, T3);
    expect(log.covers(A, T1.getTime() - 1)).toBe(true);
    expect(log.covers(A, T2.getTime())).toBe(false);
    expect(log.covers(A, T3.getTime() - 1)).toBe(false);
    expect(log.covers(A, T3.getTime())).toBe(true);
  });

  it("lists the clones whose consent is open, and only those", async () => {
    const log = await ConsentLog.load(new InMemoryConsentHistory());
    await log.open(A, T1);
    await log.open(B, T1);
    await log.close(A, T2);
    expect(log.openClones()).toEqual([B]);
  });

  it("keeps two clones of one path apart", async () => {
    const log = await ConsentLog.load(new InMemoryConsentHistory());
    await log.open(A, T1);
    expect(log.covers(B, T2.getTime())).toBe(false);
    await log.close(B, T2);
    expect(log.covers(A, T3.getTime())).toBe(true);
  });
});
