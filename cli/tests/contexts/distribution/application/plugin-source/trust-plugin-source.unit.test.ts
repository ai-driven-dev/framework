import { describe, expect, it } from "vitest";
import { TrustPluginSource } from "../../../../../src/contexts/distribution/application/plugin-source/trust-plugin-source.js";
import { InMemoryMarketplaceTrustStore } from "../../../../shared/testing/in-memory-marketplace-trust-store.fake.js";

const ROOT = "/project";
const SOURCE = { kind: "local" as const, path: "/plugins/one" };

describe("TrustPluginSource", () => {
  it("reports trusted for a source already trusted", async () => {
    const store = new InMemoryMarketplaceTrustStore();
    await store.trust(ROOT, SOURCE);

    expect(await new TrustPluginSource(store).execute({ projectRoot: ROOT, source: SOURCE })).toBe(
      "trusted"
    );
  });

  it("reports that a person must confirm an unknown source, and trusts nothing", async () => {
    const store = new InMemoryMarketplaceTrustStore();

    expect(await new TrustPluginSource(store).execute({ projectRoot: ROOT, source: SOURCE })).toBe(
      "needs-confirmation"
    );
    expect(await store.isTrusted(ROOT, SOURCE)).toBe(false);
  });

  it("trusts an unknown source when told to skip the question", async () => {
    const store = new InMemoryMarketplaceTrustStore();

    const result = await new TrustPluginSource(store).execute({
      projectRoot: ROOT,
      source: SOURCE,
      yes: true,
    });

    expect(result).toBe("trusted");
    expect(await store.isTrusted(ROOT, SOURCE)).toBe(true);
  });
});
