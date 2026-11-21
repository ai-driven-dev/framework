import { describe, expect, it } from "vitest";
import { PrepareMarketplace } from "../../../../../src/contexts/distribution/application/add/prepare-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { InvalidMarketplaceNameError } from "../../../../../src/shared/domain/errors/invalid-marketplace-name-error.js";
import { InvalidPluginManifestError } from "../../../../../src/shared/domain/errors/invalid-plugin-manifest-error.js";
import { MarketplaceAlreadyRegisteredError } from "../../../../../src/shared/domain/errors/marketplace-already-registered-error.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { InMemoryMarketplaceTrustStore } from "../../../../shared/testing/in-memory-marketplace-trust-store.fake.js";
import { resolvingCatalogs } from "../../testing/catalog-resolver.builder.js";

const PROJECT = "/project";
const SOURCE = { kind: "local", path: "/mkt/awesome" } as const;
const COMMAND = {
  source: SOURCE,
  name: "awesome",
  scope: "project",
  projectRoot: PROJECT,
} as const;

function prepareOver(
  catalogs: Parameters<typeof resolvingCatalogs>[0] = { "/mkt/awesome": { plugins: [] } }
) {
  const registry = new InMemoryMarketplaceRegistry();
  const trustStore = new InMemoryMarketplaceTrustStore();
  const prepare = new PrepareMarketplace(registry, trustStore, resolvingCatalogs(catalogs));
  return { prepare, registry, trustStore };
}

describe("PrepareMarketplace", () => {
  it("reports an untrusted source and saves nothing", async () => {
    const { prepare, registry } = prepareOver();

    const { marketplace, trusted } = await prepare.execute(COMMAND);

    expect(marketplace.name).toBe("awesome");
    expect(trusted).toBe(false);
    expect(await registry.list(PROJECT)).toEqual([]);
  });

  it("reports a source already trusted", async () => {
    const { prepare, trustStore } = prepareOver();
    await trustStore.trust(PROJECT, SOURCE);

    expect((await prepare.execute(COMMAND)).trusted).toBe(true);
  });

  it("refuses a name already registered", async () => {
    const { prepare, registry } = prepareOver();
    const { marketplace } = await prepare.execute(COMMAND);
    await registry.save(PROJECT, marketplace);

    await expect(prepare.execute(COMMAND)).rejects.toBeInstanceOf(
      MarketplaceAlreadyRegisteredError
    );
  });

  it("accepts a name already registered when the caller replaces it", async () => {
    const { prepare, registry } = prepareOver();
    await registry.save(
      PROJECT,
      Marketplace.create({
        name: "awesome",
        source: SOURCE,
        scope: "project",
        addedAt: "2026-01-01T00:00:00.000Z",
      })
    );

    const { marketplace } = await prepare.execute({ ...COMMAND, replace: true });

    expect(marketplace.name).toBe("awesome");
  });

  it("refuses the name the framework registers itself under", async () => {
    const { prepare } = prepareOver();

    await expect(
      prepare.execute({ ...COMMAND, name: FRAMEWORK_MARKETPLACE_NAME })
    ).rejects.toBeInstanceOf(InvalidMarketplaceNameError);
  });

  it("refuses a source that carries no catalog", async () => {
    const { prepare } = prepareOver({ "/mkt/awesome": null });

    await expect(prepare.execute(COMMAND)).rejects.toBeInstanceOf(InvalidPluginManifestError);
  });
});
