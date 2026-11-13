import { afterEach, describe, expect, it } from "vitest";
import type { MarketplaceTrustStore } from "../../../../src/contexts/distribution/ports/marketplace-trust-store.js";
import type { PluginSource } from "../../../../src/kernel/source.js";

export interface MarketplaceTrustStoreSubject {
  readonly store: MarketplaceTrustStore;
  readonly projectRoot: string;
  readonly otherProjectRoot: string;
  dispose(): Promise<void>;
}

const github: PluginSource = { kind: "github", repo: "owner/repo" };
const other: PluginSource = { kind: "github", repo: "owner/other" };

/** What remembering a trusted marketplace source promises, whatever holds it. */
export function describeMarketplaceTrustStoreContract(
  subjectName: string,
  makeSubject: () => Promise<MarketplaceTrustStoreSubject>
): void {
  describe(`when the trusted sources are kept ${subjectName}`, () => {
    const opened: MarketplaceTrustStoreSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<MarketplaceTrustStoreSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("trusts nothing until a source is trusted", async () => {
      const { store, projectRoot } = await given();

      expect(await store.isTrusted(projectRoot, github)).toBe(false);
    });

    it("trusts the source it was told to, and no other, keeping those trusted before", async () => {
      const { store, projectRoot } = await given();
      await store.trust(projectRoot, github);
      expect(await store.isTrusted(projectRoot, other)).toBe(false);

      await store.trust(projectRoot, other);

      expect(await store.isTrusted(projectRoot, github)).toBe(true);
      expect(await store.isTrusted(projectRoot, other)).toBe(true);
    });

    it("keeps the trust of one project out of another", async () => {
      const { store, projectRoot, otherProjectRoot } = await given();
      await store.trust(projectRoot, github);

      expect(await store.isTrusted(otherProjectRoot, github)).toBe(false);
    });
  });
}
