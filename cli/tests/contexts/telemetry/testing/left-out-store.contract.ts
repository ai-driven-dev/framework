import { expect, it } from "vitest";
import type { LeftOutStore } from "../../../../src/contexts/telemetry/ports/usage-ledger.js";
import { type ContractSubject, describeSubject } from "./contract-subject.builder.js";

export interface LeftOutStoreSubject extends ContractSubject {
  readonly store: LeftOutStore;
}

/** What the left-out store promises, stated once and run against every implementation of it. */
export function describeLeftOutStoreContract(
  subjectName: string,
  makeSubject: () => Promise<LeftOutStoreSubject>
): void {
  describeSubject(`when what was left out is held ${subjectName}`, makeSubject, (subject) => {
    it("counts nothing before anything is added", async () => {
      expect(await subject().store.counts()).toStrictEqual({
        undated: 0,
        unrecognised: 0,
        requestless: 0,
      });
    });

    it("counts each thing once per reason, however often it is added", async () => {
      await subject().store.add([
        { reason: "undated", of: "a" },
        { reason: "undated", of: "b" },
        { reason: "requestless", of: "a" },
      ]);
      await subject().store.add([{ reason: "undated", of: "a" }]);

      expect(await subject().store.counts()).toStrictEqual({
        undated: 2,
        unrecognised: 0,
        requestless: 1,
      });
    });
  });
}
