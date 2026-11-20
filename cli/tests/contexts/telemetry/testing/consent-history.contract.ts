import { expect, it } from "vitest";
import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type { ConsentEvent } from "../../../../src/contexts/telemetry/domain/consent/consent-history.js";
import type { ConsentHistory } from "../../../../src/contexts/telemetry/ports/consent-history.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";

export interface ConsentHistorySubject extends ContractSubject {
  readonly history: ConsentHistory;
}

const CLONE: CloneIdentity = {
  path: "/a/.git",
  dev: "16",
  ino: "99",
  birthtimeMs: 1_700_000_000_000,
};

const EVENTS: readonly ConsentEvent[] = [
  { kind: "open", token: "t1", clone: CLONE, at: "2026-10-01T00:00:00.000Z" },
  { kind: "close", token: "t1", at: "2026-10-02T00:00:00.000Z" },
];

/** What the consent history promises, stated once and run against every implementation of it. */
export function describeConsentHistoryContract(
  subjectName: string,
  makeSubject: () => Promise<ConsentHistorySubject>
): void {
  describeSubject(`when the consent history is ${subjectName}`, makeSubject, (subject) => {
    it("is empty and undamaged before anything is written", async () => {
      expect(await subject().history.read()).toEqual({ events: [], damaged: false });
    });

    it("reads back every event appended, in the order it was written", async () => {
      for (const event of EVENTS) await subject().history.append(event);

      expect(await subject().history.read()).toEqual({ events: EVENTS, damaged: false });
    });
  });
}
