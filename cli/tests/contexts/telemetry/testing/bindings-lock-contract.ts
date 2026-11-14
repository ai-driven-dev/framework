import { expect, it } from "vitest";
import type { BindingsLock } from "../../../../src/contexts/telemetry/ports/bindings/bindings-lock.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";

export interface BindingsLockSubject extends ContractSubject {
  readonly lock: BindingsLock;
}

/** What the bindings lock promises, stated once and run against every implementation of it. */
export function describeBindingsLockContract(
  subjectName: string,
  makeSubject: () => Promise<BindingsLockSubject>
): void {
  describeSubject(`when the bindings lock is ${subjectName}`, makeSubject, (subject) => {
    it("returns what the work returns, and lets one writer at a time in", async () => {
      expect(await subject().lock.exclusively(async () => 7)).toBe(7);
      const events: string[] = [];
      const work = (name: string) => async () => {
        events.push(`${name}:in`);
        await new Promise((done) => setTimeout(done, 40));
        events.push(`${name}:out`);
      };

      await Promise.all([
        subject().lock.exclusively(work("a")),
        subject().lock.exclusively(work("b")),
      ]);

      expect(events.map((e) => e.slice(2))).toEqual(["in", "out", "in", "out"]);
      expect(events[0]?.[0]).toBe(events[1]?.[0]);
    });

    it("lets the next writer in after work that threw", async () => {
      await expect(
        subject().lock.exclusively(async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      expect(await subject().lock.exclusively(async () => "next")).toBe("next");
    });
  });
}
