import { describe, expect, it } from "vitest";
import { ResolveAddedPluginSource } from "../../../../../../src/contexts/installation/application/plugin/add/resolve-plugin-source.js";
import { PluginDistributionLoader } from "../../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { buildUnitDeps } from "../../../../../helpers/ports/build-unit-deps.js";
import { fakeBuildSources } from "../../../../../helpers/ports/fake-build-sources.js";
import { FakeMarketplaceRegistry } from "../../../testing/fake-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";

async function resolverOver(registry: FakeMarketplaceRegistry) {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  return new ResolveAddedPluginSource({
    distributionLoader: new PluginDistributionLoader(
      deps.pluginFetcher,
      deps.pluginDistributionReader
    ),
    marketplaceRegistry: registry,
    ...fakeBuildSources(),
  });
}

describe("ResolveAddedPluginSource", () => {
  describe("isGithubMarketplace", () => {
    it("holds for a github marketplace the registry lists", async () => {
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
      });

      const resolver = await resolverOver(registry);

      expect(await resolver.isGithubMarketplace("aidd-framework", PROJECT_ROOT)).toBe(true);
    });

    it("answers for the named marketplace, not the first one registered", async () => {
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
      });
      registry.seed(PROJECT_ROOT, {
        name: "local-mkt",
        source: { kind: "local", path: "/mkt-source" },
        scope: "project",
      });

      const resolver = await resolverOver(registry);

      expect(await resolver.isGithubMarketplace("local-mkt", PROJECT_ROOT)).toBe(false);
    });

    it("fails for a name the registry does not list", async () => {
      const resolver = await resolverOver(new FakeMarketplaceRegistry());

      expect(await resolver.isGithubMarketplace("ghost", PROJECT_ROOT)).toBe(false);
    });
  });
});
