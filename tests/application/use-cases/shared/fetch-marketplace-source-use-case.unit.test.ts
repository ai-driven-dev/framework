import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FetchMarketplaceSourceUseCase } from "../../../../src/application/use-cases/shared/fetch-marketplace-source-use-case.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import type { PluginSourceGitHub } from "../../../../src/domain/models/plugin-source.js";
import type { RawCatalogFetcher } from "../../../../src/domain/ports/raw-catalog-fetcher.js";
import { FixturePluginFetcher } from "../../../helpers/ports/fixture-plugin-fetcher.js";

const PROJECT_ROOT = "/test-project";
const LOCAL_PATH = "/local/marketplace";
const CACHE_DIR = join(PROJECT_ROOT, ".aidd/cache/marketplace/my-mkt");

function makeLocalMarketplace(): Marketplace {
  return Marketplace.create({
    name: "my-mkt",
    source: { kind: "local", path: LOCAL_PATH },
    scope: "project",
    addedAt: "2026-05-06T00:00:00.000Z",
  });
}

function makeGitHubMarketplace(ref?: string): Marketplace {
  return Marketplace.create({
    name: "my-mkt",
    source: { kind: "github", repo: "owner/repo", ref },
    scope: "project",
    addedAt: "2026-05-06T00:00:00.000Z",
  });
}

class SpyRawCatalogFetcher implements RawCatalogFetcher {
  calls: Array<{ source: PluginSourceGitHub; catalogPath: string; cacheDir: string }> = [];
  private readonly returnPath: string;

  constructor(returnPath: string) {
    this.returnPath = returnPath;
  }

  async fetchCatalog(
    source: PluginSourceGitHub,
    catalogPath: string,
    cacheDir: string
  ): Promise<string> {
    this.calls.push({ source, catalogPath, cacheDir });
    return this.returnPath;
  }
}

describe("FetchMarketplaceSourceUseCase", () => {
  describe("local source", () => {
    it("delegates to pluginFetcher for local sources", async () => {
      const fetcher = new FixturePluginFetcher();
      const uc = new FetchMarketplaceSourceUseCase(fetcher);

      const result = await uc.execute({ marketplace: makeLocalMarketplace(), cacheDir: CACHE_DIR });

      expect(result).toBe(LOCAL_PATH);
    });
  });

  describe("github source without rawCatalogFetcher", () => {
    it("delegates to pluginFetcher when no rawCatalogFetcher provided", async () => {
      const fetcher = new FixturePluginFetcher({
        '{"kind":"github","repo":"owner/repo"}': "/cached/path",
      });
      const uc = new FetchMarketplaceSourceUseCase(fetcher);

      const result = await uc.execute({
        marketplace: makeGitHubMarketplace(),
        cacheDir: CACHE_DIR,
      });

      expect(result).toBe("/cached/path");
    });
  });

  describe("github source with rawCatalogFetcher", () => {
    it("routes github sources through rawCatalogFetcher", async () => {
      const spy = new SpyRawCatalogFetcher("/raw/cache");
      const fetcher = new FixturePluginFetcher();
      const uc = new FetchMarketplaceSourceUseCase(fetcher, spy);

      const result = await uc.execute({
        marketplace: makeGitHubMarketplace("v3.9.0"),
        cacheDir: CACHE_DIR,
      });

      expect(result).toBe("/raw/cache");
      expect(spy.calls).toHaveLength(1);
    });

    it("preserves ref when routing github source to rawCatalogFetcher", async () => {
      const spy = new SpyRawCatalogFetcher("/raw/cache");
      const uc = new FetchMarketplaceSourceUseCase(new FixturePluginFetcher(), spy);

      await uc.execute({
        marketplace: makeGitHubMarketplace("v4.1.0-beta.14"),
        cacheDir: CACHE_DIR,
      });

      expect(spy.calls[0]?.source.ref).toBe("v4.1.0-beta.14");
    });

    it("passes undefined ref to rawCatalogFetcher when no ref set", async () => {
      const spy = new SpyRawCatalogFetcher("/raw/cache");
      const uc = new FetchMarketplaceSourceUseCase(new FixturePluginFetcher(), spy);

      await uc.execute({
        marketplace: makeGitHubMarketplace(undefined),
        cacheDir: CACHE_DIR,
      });

      expect(spy.calls[0]?.source.ref).toBeUndefined();
    });

    it("passes cacheDir to rawCatalogFetcher", async () => {
      const spy = new SpyRawCatalogFetcher("/raw/cache");
      const uc = new FetchMarketplaceSourceUseCase(new FixturePluginFetcher(), spy);

      await uc.execute({
        marketplace: makeGitHubMarketplace("v3.9.0"),
        cacheDir: CACHE_DIR,
      });

      expect(spy.calls[0]?.cacheDir).toBe(CACHE_DIR);
    });
  });

  describe("forceRefresh propagation", () => {
    it("passes forceRefresh to pluginFetcher for local sources", async () => {
      const calls: Array<{ forceRefresh: boolean | undefined }> = [];
      const fetcher: FixturePluginFetcher = new FixturePluginFetcher();
      const origFetch = fetcher.fetch.bind(fetcher);
      fetcher.fetch = async (source, cacheDir, opts) => {
        calls.push({ forceRefresh: opts?.forceRefresh });
        return origFetch(source, cacheDir, opts);
      };
      const uc = new FetchMarketplaceSourceUseCase(fetcher);

      await uc.execute({
        marketplace: makeLocalMarketplace(),
        cacheDir: CACHE_DIR,
        fetchOptions: { forceRefresh: true },
      });

      expect(calls[0]?.forceRefresh).toBe(true);
    });
  });
});
