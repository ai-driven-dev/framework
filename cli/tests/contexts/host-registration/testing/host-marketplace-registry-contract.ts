import { afterEach, describe, expect, it } from "vitest";
import type { HostMarketplaceRegistry } from "../../../../src/contexts/host-registration/contract/host-marketplace-registry.js";

/** A source no machine resolves, so a reader that compares real paths answers it unchanged. */
export const UNRESOLVED_SOURCE = "/srv/aidd-host-registration/marketplace";

export type MarketplaceRegistryScenario =
  | { kind: "holds"; name: string; source: string }
  | { kind: "empty" }
  | { kind: "absent" }
  | { kind: "unreadable" };

export interface MarketplaceRegistrySubject {
  readonly registry: HostMarketplaceRegistry;
  dispose(): Promise<void>;
}

/**
 * What a host's marketplace registry reading promises: a name it holds answers the source it
 * points at, an empty registry is an answer, and `entries` is never reachable from a registry
 * that could not be read, because an empty map would then prove a purge safe.
 */
export function describeHostMarketplaceRegistryContract(
  subjectName: string,
  makeSubject: (scenario: MarketplaceRegistryScenario) => Promise<MarketplaceRegistrySubject>
): void {
  describe(`when the host marketplace registry is ${subjectName}`, () => {
    const opened: MarketplaceRegistrySubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function read(scenario: MarketplaceRegistryScenario) {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject.registry.read();
    }

    it("answers the source a held name points at", async () => {
      const reading = await read({ kind: "holds", name: "aidd", source: UNRESOLVED_SOURCE });

      expect(reading.entries?.get("aidd")).toBe(UNRESOLVED_SOURCE);
      expect(reading.absent).toBeUndefined();
      expect(reading.unreadable).toBeUndefined();
    });

    it("answers an empty map when it holds no marketplace, not an absent registry", async () => {
      const reading = await read({ kind: "empty" });

      expect(reading.entries?.size).toBe(0);
      expect(reading.absent).toBeUndefined();
    });

    it("says absent, and answers no entries, when the registry does not exist", async () => {
      const reading = await read({ kind: "absent" });

      expect(reading.absent).toBe(true);
      expect(reading.entries).toBeUndefined();
      expect(reading.unreadable).toBeUndefined();
    });

    it("says why, and answers no entries, when the registry cannot be read", async () => {
      const reading = await read({ kind: "unreadable" });

      expect(reading.unreadable).toEqual(expect.any(String));
      expect(reading.entries).toBeUndefined();
      expect(reading.absent).toBeUndefined();
    });
  });
}
