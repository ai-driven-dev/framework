import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PrepareMarketplace } from "../../../../../src/contexts/distribution/application/add/prepare-marketplace.js";
import { FetchMarketplaceSource } from "../../../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ResolveMarketplace } from "../../../../../src/contexts/distribution/application/resolve-marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import {
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
  MarketplaceAlreadyRegisteredError,
} from "../../../../../src/shared/domain/errors.js";
import { FixturePluginFetcher } from "../../../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { InMemoryMarketplaceTrustStore } from "../../../../shared/testing/in-memory-marketplace-trust-store.fake.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";

const MARKETPLACE_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";

async function build() {
  const fs = new InMemoryFileAdapter({});
  await seedFromDirectory(fs, MARKETPLACE_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const trustStore = new InMemoryMarketplaceTrustStore();
  const fetchMarketplaceSource = new FetchMarketplaceSource(new FixturePluginFetcher());
  const resolveMarketplace = new ResolveMarketplace(
    fetchMarketplaceSource,
    new PluginCatalogRepositoryAdapter(fs)
  );
  const prepare = new PrepareMarketplace(registry, trustStore, resolveMarketplace);
  return { prepare, registry, trustStore };
}
const SOURCE = { kind: "local" as const, path: MARKETPLACE_FIXTURE };
const COMMAND = {
  source: SOURCE,
  name: "awesome",
  scope: "project" as const,
  projectRoot: PROJECT_ROOT,
};

describe("PrepareMarketplace", () => {
  it("reports an untrusted source and saves nothing", async () => {
    const { prepare, registry, trustStore } = await build();

    const { marketplace, trusted } = await prepare.execute(COMMAND);

    expect(marketplace.name).toBe("awesome");
    expect(trusted).toBe(false);
    expect(await registry.list(PROJECT_ROOT)).toHaveLength(0);
    expect(await trustStore.isTrusted(PROJECT_ROOT, SOURCE)).toBe(false);
  });

  it("reports a source already trusted", async () => {
    const { prepare, trustStore } = await build();
    await trustStore.trust(PROJECT_ROOT, SOURCE);

    expect((await prepare.execute(COMMAND)).trusted).toBe(true);
  });

  it("throws when name is already registered", async () => {
    const { prepare, registry } = await build();
    const { marketplace } = await prepare.execute(COMMAND);
    await registry.save(PROJECT_ROOT, marketplace);

    await expect(prepare.execute(COMMAND)).rejects.toThrow(MarketplaceAlreadyRegisteredError);
  });

  it("rejects the reserved name 'aidd-framework'", async () => {
    const { prepare } = await build();

    await expect(prepare.execute({ ...COMMAND, name: "aidd-framework" })).rejects.toThrow(
      InvalidMarketplaceNameError
    );
  });

  it("throws InvalidPluginManifestError when marketplace.json is missing at the source", async () => {
    const { prepare } = await build();

    await expect(
      prepare.execute({ ...COMMAND, source: { kind: "local", path: "/empty-marketplace-dir" } })
    ).rejects.toThrow(InvalidPluginManifestError);
  });
});
