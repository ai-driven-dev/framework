import { describe, expect, it } from "vitest";
import { cloneOf } from "../../testing/clone.builder.js";
import { MAIN, setup, T1, T2 } from "../../testing/telemetry-switch.builder.js";

const grant = (s: ReturnType<typeof setup>) => s.grant.execute({ root: "/w/repo", identity: MAIN });

describe("giving a clone's consent", () => {
  it("writes the key before the interval, so a crash between leaves a key that measures nothing", async () => {
    const s = setup();
    const append = s.history.append.bind(s.history);
    s.history.append = async (event) => {
      s.events.push(`interval-${event.kind}`);
      await append(event);
    };
    await grant(s);
    expect(s.events).toEqual(["lock", "consent", "interval-open", "unlock"]);
  });

  it("opens the clone's interval at its own time, once", async () => {
    const s = setup();
    expect(await grant(s)).toBe(true);
    s.clock.now = new Date(T2);
    expect(await grant(s)).toBe(false);
    expect(s.history.written).toEqual([{ kind: "open", token: "tok-1", clone: MAIN, at: T1 }]);
  });

  it("opens an interval again when the key was set by hand, with none open", async () => {
    for (const value of ["2", "2:forged"]) {
      const s = setup();
      s.consents.values.set("/w/repo", value);
      await grant(s);
      expect(s.history.written).toEqual([{ kind: "open", token: "tok-1", clone: MAIN, at: T1 }]);
      expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
    }
  });

  it("closes an interval of the clone that its key no longer names before it opens the next", async () => {
    const s = setup();
    s.history.written.push({ kind: "open", token: "old", clone: MAIN, at: T1 });
    s.consents.values.set("/w/repo", "off");
    s.clock.now = new Date(T2);
    await grant(s);
    expect(s.history.written).toEqual([
      { kind: "open", token: "old", clone: MAIN, at: T1 },
      { kind: "close", token: "old", at: T2 },
      { kind: "open", token: "tok-1", clone: MAIN, at: T2 },
    ]);
  });

  it("leaves another clone's interval alone", async () => {
    const s = setup();
    s.history.written.push({
      kind: "open",
      token: "theirs",
      clone: cloneOf("/w/other/.git"),
      at: T1,
    });
    await grant(s);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open", "open"]);
  });

  it("adds nothing to a log it cannot trust, and writes no key", async () => {
    const s = setup();
    s.history.damaged = true;
    expect(await grant(s)).toBe("damaged");
    expect(s.writes).toEqual([]);
    expect(s.history.written).toEqual([]);
  });
});
