import { describe, expect, it } from "vitest";
import { ResolvePluginSource } from "../../../../../src/contexts/distribution/application/plugin-source/resolve-plugin-source.use-case.js";
import type { PluginCatalog } from "../../../../../src/contexts/distribution/contract/catalog.js";
import { PluginNotInMarketplaceError } from "../../../../../src/contexts/distribution/domain/distribution.error.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { PluginSource } from "../../../../../src/shared/domain/source.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { fetchedPathOf, resolvingCatalogs } from "../../testing/catalog-resolver.builder.js";

const PROJECT = "/project";

function catalogOf(...entries: Array<{ name: string; source: PluginSource }>): PluginCatalog {
  return { plugins: entries.map((e) => ({ ...e, recommended: false, strict: false })) };
}

function localMarketplace(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "local", path: `/mkt/${name}` },
    scope: "project",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

function githubMarketplace(name: string, repo: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "github", repo },
    scope: "project",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

async function registryOf(...marketplaces: Marketplace[]): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  for (const marketplace of marketplaces) await registry.save(PROJECT, marketplace);
  return registry;
}

const PLUGIN_ON_GITHUB: PluginSource = { kind: "github", repo: "owner/plugin" };

describe("ResolvePluginSource", () => {
  it("answers one match per marketplace that catalogues the plugin", async () => {
    const registry = await registryOf(localMarketplace("a"), localMarketplace("b"));
    const resolve = new ResolvePluginSource(
      registry,
      resolvingCatalogs({
        "/mkt/a": catalogOf({ name: "p", source: PLUGIN_ON_GITHUB }),
        "/mkt/b": catalogOf(
          { name: "p", source: PLUGIN_ON_GITHUB },
          { name: "q", source: PLUGIN_ON_GITHUB }
        ),
      })
    );

    const matches = await resolve.execute({ pluginName: "p", projectRoot: PROJECT });

    expect(matches.map((m) => [m.marketplaceName, m.entry.name, m.githubMarketplace])).toEqual([
      ["a", "p", false],
      ["b", "p", false],
    ]);
  });

  it("restricts the search to the marketplace named", async () => {
    const registry = await registryOf(localMarketplace("a"), localMarketplace("b"));
    const resolve = new ResolvePluginSource(
      registry,
      resolvingCatalogs({
        "/mkt/a": catalogOf({ name: "p", source: PLUGIN_ON_GITHUB }),
        "/mkt/b": catalogOf({ name: "p", source: PLUGIN_ON_GITHUB }),
      })
    );

    const matches = await resolve.execute({
      pluginName: "p",
      projectRoot: PROJECT,
      fromMarketplace: "b",
    });

    expect(matches.map((m) => m.marketplaceName)).toEqual(["b"]);
  });

  it("skips a marketplace that has no catalog", async () => {
    const registry = await registryOf(localMarketplace("a"), localMarketplace("b"));
    const resolve = new ResolvePluginSource(
      registry,
      resolvingCatalogs({
        "/mkt/a": null,
        "/mkt/b": catalogOf({ name: "p", source: PLUGIN_ON_GITHUB }),
      })
    );

    const matches = await resolve.execute({ pluginName: "p", projectRoot: PROJECT });

    expect(matches.map((m) => m.marketplaceName)).toEqual(["b"]);
  });

  it("resolves a local entry of a github marketplace to a subdirectory of its repository", async () => {
    const registry = await registryOf(githubMarketplace("gh", "owner/repo"));
    const resolve = new ResolvePluginSource(
      registry,
      resolvingCatalogs({
        [fetchedPathOf("owner/repo")]: catalogOf({
          name: "p",
          source: { kind: "local", path: "./plugins/p" },
        }),
      })
    );

    const [match] = await resolve.execute({ pluginName: "p", projectRoot: PROJECT });

    expect(match?.githubMarketplace).toBe(true);
    expect(match?.source).toEqual({
      kind: "git-subdir",
      url: "https://github.com/owner/repo.git",
      path: "plugins/p",
      ref: undefined,
    });
  });

  it("throws when no marketplace catalogues the plugin", async () => {
    const registry = await registryOf(localMarketplace("a"));
    const resolve = new ResolvePluginSource(
      registry,
      resolvingCatalogs({ "/mkt/a": catalogOf({ name: "other", source: PLUGIN_ON_GITHUB }) })
    );

    await expect(resolve.execute({ pluginName: "p", projectRoot: PROJECT })).rejects.toBeInstanceOf(
      PluginNotInMarketplaceError
    );
  });
});
