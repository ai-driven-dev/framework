import { describe, expect, it } from "vitest";
import { RecordMarketplace } from "../../../../../src/contexts/distribution/application/add/record-marketplace.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { InMemoryMarketplaceTrustStore } from "../../../../helpers/ports/in-memory-marketplace-trust-store.js";

const PROJECT_ROOT = "/test-project";
const SOURCE = { kind: "local" as const, path: "/marketplace" };

function build() {
  const registry = new InMemoryMarketplaceRegistry();
  const trustStore = new InMemoryMarketplaceTrustStore();
  const marketplace = Marketplace.create({
    name: "awesome",
    source: SOURCE,
    scope: "project",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
  return { record: new RecordMarketplace(registry, trustStore), registry, trustStore, marketplace };
}

describe("RecordMarketplace", () => {
  it("saves the marketplace and trusts its source when asked", async () => {
    const { record, registry, trustStore, marketplace } = build();

    await record.execute({ marketplace, projectRoot: PROJECT_ROOT, trust: true });

    expect(await registry.list(PROJECT_ROOT)).toHaveLength(1);
    expect(await trustStore.isTrusted(PROJECT_ROOT, SOURCE)).toBe(true);
  });

  it("saves without trusting when not asked", async () => {
    const { record, registry, trustStore, marketplace } = build();

    await record.execute({ marketplace, projectRoot: PROJECT_ROOT, trust: false });

    expect(await registry.list(PROJECT_ROOT)).toHaveLength(1);
    expect(await trustStore.isTrusted(PROJECT_ROOT, SOURCE)).toBe(false);
  });
});
