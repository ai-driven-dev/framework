import { describe, expect, it } from "vitest";
import { cloneOf } from "../../testing/clone.builder.js";
import { MAIN, repository, setup, T1, T2 } from "../../testing/telemetry-switch.builder.js";

const OPEN = { kind: "open", token: "tok-1", clone: MAIN, at: T1 } as const;
const withdraw = (s: ReturnType<typeof setup>, located = repository("/w/repo", "/w/main")) =>
  s.withdraw.execute({ located, token: "tok-1" });

describe("withdrawing a clone's consent", () => {
  it("closes the interval its key names at its path, though the identity read there moved since", async () => {
    const s = setup();
    s.history.written.push(OPEN);
    s.clock.now = new Date(T2);
    // Where Linux refuses `statx`, the birth time is the change time, and `on` itself moved it.
    const moved = {
      ...repository("/w/repo", "/w/main"),
      clone: cloneOf("/w/main/.git", { birthtimeMs: 2_000 }),
    };
    expect(await withdraw(s, moved)).toEqual({ changed: true });
    expect(s.history.written.at(-1)).toEqual({ kind: "close", token: "tok-1", at: T2 });
  });

  it("leaves the interval of the clone a copy was made from, its key naming it at another path", async () => {
    const s = setup();
    s.history.written.push(OPEN);
    await withdraw(s, repository("/w/copy"));
    expect(s.history.written).toEqual([OPEN]);
  });

  it("writes the key under the ledger's lock with the interval, and nothing when there is no consent", async () => {
    const s = setup();
    s.history.written.push(OPEN);
    await withdraw(s);
    expect(s.events).toEqual(["lock", "consent", "unlock"]);
    expect(s.writes).toEqual([{ root: "/w/repo", value: "off" }]);
    const none = setup();
    expect(await none.withdraw.execute({ located: repository("/w/repo"), token: null })).toEqual({
      changed: false,
    });
    expect(none.history.written).toEqual([]);
    expect(none.writes).toEqual([]);
  });

  it("closes an interval once", async () => {
    const s = setup();
    s.history.written.push(OPEN);
    await withdraw(s);
    await withdraw(s);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open", "close"]);
  });

  it("still switches the key off for a clone the file system gives no identity, and leaves another's interval", async () => {
    const s = setup();
    s.history.written.push({ ...OPEN, token: "theirs", clone: cloneOf("/w/other/.git") });
    const located = { ...repository("/w/repo", "/w/main"), clone: null };
    expect(await s.withdraw.execute({ located, token: "held" })).toEqual({ changed: true });
    expect(s.writes).toEqual([{ root: "/w/repo", value: "off" }]);
    expect(s.history.written).toHaveLength(1);
  });

  it("adds nothing to a log it cannot trust, and leaves the key as it is", async () => {
    const s = setup();
    s.history.damaged = true;
    expect(await withdraw(s)).toBe("damaged");
    expect(s.writes).toEqual([]);
  });
});
