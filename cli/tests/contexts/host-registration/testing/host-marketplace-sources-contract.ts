import { afterEach, describe, expect, it } from "vitest";
import type { HostMarketplaceSources } from "../../../../src/contexts/host-registration/contract/host-marketplace-sources.js";

export type MarketplaceSourcesScenario =
  | { kind: "holds"; name: string; source: string }
  | { kind: "empty" }
  | { kind: "unreadable" };

export interface MarketplaceSourcesSubject {
  readonly sources: HostMarketplaceSources;
  readonly projectRoot: string;
  dispose(): Promise<void>;
}

/**
 * What the sources a host reports promise: a held name answers its source, a host holding none
 * answers an empty map, and a host that could not be asked says why and answers no map, since
 * a missing name in a readable map is what proves absence.
 */
export function describeHostMarketplaceSourcesContract(
  subjectName: string,
  makeSubject: (scenario: MarketplaceSourcesScenario) => Promise<MarketplaceSourcesSubject>
): void {
  describe(`when the host marketplace sources are ${subjectName}`, () => {
    const opened: MarketplaceSourcesSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function read(scenario: MarketplaceSourcesScenario) {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject.sources.read(subject.projectRoot);
    }

    it("answers the source a held name points at", async () => {
      const reading = await read({ kind: "holds", name: "aidd", source: "/srv/aidd/market" });

      expect(reading.entries?.get("aidd")?.source).toBe("/srv/aidd/market");
      expect(reading.unreadable).toBeUndefined();
    });

    it("answers an empty map when the host holds no marketplace", async () => {
      const reading = await read({ kind: "empty" });

      expect(reading.entries?.size).toBe(0);
      expect(reading.unreadable).toBeUndefined();
    });

    it("says why, and answers no map, when the host could not be asked", async () => {
      const reading = await read({ kind: "unreadable" });

      expect(reading.unreadable).toEqual(expect.any(String));
      expect(reading.entries).toBeUndefined();
    });

    it("names the place it read", async () => {
      expect((await read({ kind: "empty" })).location).not.toBe("");
    });
  });
}
