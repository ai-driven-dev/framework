import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Lock } from "../../../src/shared/ports/lock.js";

/** What a contract run needs from one implementation of the lock port. */
export interface LockSubject {
  readonly lock: Lock;
  dispose(): Promise<void>;
}

const HOLD_MS = 40;

/** What the lock port promises, stated once and run against every implementation of it. */
export function describeLockContract(subjectName: string, makeSubject: () => Promise<LockSubject>) {
  describe(`when the lock is ${subjectName}`, () => {
    let subject: LockSubject;
    beforeEach(async () => {
      subject = await makeSubject();
    });
    afterEach(async () => {
      await subject.dispose();
    });

    it("returns what the action returns", async () => {
      expect(await subject.lock.withExclusiveAccess(async () => 7)).toBe(7);
    });

    it("lets one action at a time in", async () => {
      const events: string[] = [];
      const action = (name: string) => async () => {
        events.push(`${name}:in`);
        await new Promise((done) => setTimeout(done, HOLD_MS));
        events.push(`${name}:out`);
      };

      await Promise.all([
        subject.lock.withExclusiveAccess(action("a")),
        subject.lock.withExclusiveAccess(action("b")),
      ]);

      expect(events.map((event) => event.slice("a:".length))).toEqual(["in", "out", "in", "out"]);
      expect(events[0]?.[0]).toBe(events[1]?.[0]);
    });

    it("lets the next action in after one that threw", async () => {
      await expect(
        subject.lock.withExclusiveAccess(async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      expect(await subject.lock.withExclusiveAccess(async () => "next")).toBe("next");
    });
  });
}
