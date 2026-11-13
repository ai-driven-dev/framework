import { afterEach, describe, expect, it } from "vitest";
import type { MarketplaceCachePort } from "../../../../src/contexts/distribution/ports/marketplace-cache.js";

export interface MarketplaceCacheSubject {
  readonly cache: MarketplaceCachePort;
  put(...names: string[]): Promise<void>;
  names(): Promise<string[]>;
  dispose(): Promise<void>;
}

/** What clearing the fetched marketplaces promises, whatever holds them. */
export function describeMarketplaceCacheContract(
  subjectName: string,
  makeSubject: () => Promise<MarketplaceCacheSubject>
): void {
  describe(`when the marketplace cache is ${subjectName}`, () => {
    const opened: MarketplaceCacheSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<MarketplaceCacheSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("clears the named entry only, and does not mind one that is absent", async () => {
      const { cache, put, names } = await given();
      await put("target", "keep");

      await cache.clear("target");
      await expect(cache.clear("nonexistent")).resolves.toBeUndefined();

      expect(await names()).toEqual(["keep"]);
    });

    it("clears every entry, and does not mind an empty cache", async () => {
      const { cache, put, names } = await given();
      await put("one", "two", "three");

      await cache.clear();
      await expect(cache.clear()).resolves.toBeUndefined();

      expect(await names()).toEqual([]);
    });
  });
}
