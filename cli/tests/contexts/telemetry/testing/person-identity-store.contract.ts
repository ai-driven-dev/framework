import { expect, it } from "vitest";
import type { PersonIdentityStore } from "../../../../src/contexts/telemetry/ports/identity/person-identity-store.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";

export interface PersonIdentitySubject extends ContractSubject {
  readonly store: PersonIdentityStore;
}

/** What the person identity store promises, stated once and run against every implementation. */
export function describePersonIdentityStoreContract(
  subjectName: string,
  makeSubject: () => Promise<PersonIdentitySubject>
): void {
  describeSubject(`when the person identity store is ${subjectName}`, makeSubject, (subject) => {
    it("holds no identifier before one is chosen", async () => {
      expect(await subject().store.read()).toBeNull();
    });

    it("answers the identifier last written", async () => {
      await subject().store.write("alice");

      expect(await subject().store.read()).toBe("alice");
    });

    it("replaces the identifier chosen before", async () => {
      await subject().store.write("alice");
      await subject().store.write("bob");

      expect(await subject().store.read()).toBe("bob");
    });

    it("says there was an identifier to remove, then that there is none", async () => {
      await subject().store.write("alice");

      expect([await subject().store.remove(), await subject().store.remove()]).toEqual([
        true,
        false,
      ]);
      expect(await subject().store.read()).toBeNull();
    });

    it("says there was nothing to remove when none was ever chosen", async () => {
      expect(await subject().store.remove()).toBe(false);
    });

    it("takes an identifier again after removing one", async () => {
      await subject().store.write("alice");
      await subject().store.remove();
      await subject().store.write("carol");

      expect(await subject().store.read()).toBe("carol");
    });
  });
}
