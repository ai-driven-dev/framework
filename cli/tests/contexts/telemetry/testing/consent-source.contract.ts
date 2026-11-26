import { expect, it } from "vitest";
import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type { ConsentSource } from "../../../../src/contexts/telemetry/ports/consent-source.js";
import { type ContractSubject, describeSubject } from "./contract-subject.builder.js";

export interface ConsentSourceSubject extends ContractSubject {
  readonly source: ConsentSource;
  /** The working tree `read` is asked about. */
  readonly root: string;
  /** The clone that working tree belongs to, as it was recorded. */
  readonly clone: CloneIdentity;
  /** Writes `aidd.telemetry` into the clone's own git config. */
  set(value: string): Promise<void>;
  /** Leaves the clone's git config unparseable. */
  breakConfig(): Promise<void>;
  /** Removes whatever the clone's path held. */
  removeClone(): Promise<void>;
  /** Puts another directory where the clone was. */
  replaceClone(): Promise<void>;
}

/** What the consent source promises, stated once and run against every implementation. */
export function describeConsentSourceContract(
  subjectName: string,
  makeSubject: () => Promise<ConsentSourceSubject>
): void {
  describeSubject(`when the consent source is ${subjectName}`, makeSubject, (subject) => {
    it("reads a working tree's consent as unset until something sets it", async () => {
      expect(await subject().source.read(subject().root)).toEqual({ kind: "value", value: null });
    });

    it("reads the value a working tree's clone holds", async () => {
      await subject().set("2");

      expect(await subject().source.read(subject().root)).toEqual({ kind: "value", value: "2" });
    });

    it("cannot read a working tree whose git config is broken", async () => {
      await subject().breakConfig();

      expect(await subject().source.read(subject().root)).toEqual({ kind: "unreadable" });
    });

    it("reads a clone's consent as unset until something sets it", async () => {
      expect(await subject().source.readClone(subject().clone)).toEqual({
        kind: "value",
        value: null,
      });
    });

    it("reads the value the clone itself holds", async () => {
      await subject().set("off");

      expect(await subject().source.readClone(subject().clone)).toEqual({
        kind: "value",
        value: "off",
      });
    });

    it("finds nothing of a clone whose path is gone", async () => {
      await subject().removeClone();

      expect(await subject().source.readClone(subject().clone)).toEqual({ kind: "absent" });
    });

    it("tells a clone from the other one now at its path", async () => {
      await subject().replaceClone();

      expect(await subject().source.readClone(subject().clone)).toEqual({ kind: "replaced" });
    });

    it("cannot read a clone whose git config is broken", async () => {
      await subject().breakConfig();

      expect(await subject().source.readClone(subject().clone)).toEqual({ kind: "unreadable" });
    });
  });
}
