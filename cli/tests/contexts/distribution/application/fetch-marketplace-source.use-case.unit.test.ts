import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.use-case.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import type { PluginSourceGitHub } from "../../../../src/shared/domain/source.js";
import { FixturePluginFetcher } from "../../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryRawCatalog, unusedRawCatalog } from "../../../shared/testing/raw-catalog.fake.js";

const PROJECT_ROOT = "/test-project";
const LOCAL_PATH = "/local/marketplace";
const CACHE_DIR = join(PROJECT_ROOT, ".aidd/cache/marketplace/my-mkt");
const FALLBACK_PATH = join(CACHE_DIR, "github-owner-repo-HEAD");
const CATALOG_FILE_PATH = join(CACHE_DIR, ".claude-plugin/marketplace.json");

const RELATIVE_CATALOG_JSON = JSON.stringify({
  plugins: [{ name: "x", source: "./plugins/x" }],
});

const ABSOLUTE_CATALOG_JSON = JSON.stringify({
  plugins: [{ name: "x", source: { kind: "github", repo: "owner/plugin" } }],
});

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

function recordingCatalog(body = ABSOLUTE_CATALOG_JSON) {
  const calls: Array<{ source: PluginSourceGitHub; catalogPath: string }> = [];
  const fetcher = new InMemoryRawCatalog((source, catalogPath) => {
    calls.push({ source, catalogPath });
    return body;
  });
  return { fetcher, calls };
}

function makeSpyFileAdapter(
  seed: Record<string, string> = {}
): InMemoryFileAdapter & { deletedFiles: string[] } {
  const adapter = new InMemoryFileAdapter(seed);
  const deletedFiles: string[] = [];
  const origDelete = adapter.deleteFile.bind(adapter);
  adapter.deleteFile = async (path: string) => {
    deletedFiles.push(path);
    return origDelete(path);
  };
  return Object.assign(adapter, { deletedFiles });
}

describe("FetchMarketplaceSource", () => {
  describe("local source", () => {
    it("delegates to pluginFetcher for local sources", async () => {
      const fetcher = new FixturePluginFetcher();
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: unusedRawCatalog(),
      });

      const result = await uc.execute({ marketplace: makeLocalMarketplace(), cacheDir: CACHE_DIR });

      expect(result).toBe(LOCAL_PATH);
    });
  });

  describe("github source through rawCatalogFetcher", () => {
    it("routes github sources through rawCatalogFetcher and returns cacheDir", async () => {
      const spy = recordingCatalog();
      const fetcher = new FixturePluginFetcher();
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: { fetcher: spy.fetcher, fs: makeSpyFileAdapter() },
      });

      const result = await uc.execute({
        marketplace: makeGitHubMarketplace("v3.9.0"),
        cacheDir: CACHE_DIR,
      });

      expect(result).toBe(CACHE_DIR);
      expect(spy.calls).toHaveLength(1);
    });

    it("preserves ref when routing github source to rawCatalogFetcher", async () => {
      const spy = recordingCatalog();
      const uc = new FetchMarketplaceSource({
        pluginFetcher: new FixturePluginFetcher(),
        rawCatalog: { fetcher: spy.fetcher, fs: makeSpyFileAdapter() },
      });

      await uc.execute({
        marketplace: makeGitHubMarketplace("v4.1.0-beta.14"),
        cacheDir: CACHE_DIR,
      });

      expect(spy.calls[0]?.source.ref).toBe("v4.1.0-beta.14");
    });

    it("passes undefined ref to rawCatalogFetcher when no ref set", async () => {
      const spy = recordingCatalog();
      const uc = new FetchMarketplaceSource({
        pluginFetcher: new FixturePluginFetcher(),
        rawCatalog: { fetcher: spy.fetcher, fs: makeSpyFileAdapter() },
      });

      await uc.execute({
        marketplace: makeGitHubMarketplace(undefined),
        cacheDir: CACHE_DIR,
      });

      expect(spy.calls[0]?.source.ref).toBeUndefined();
    });
  });

  describe("catalog cache write", () => {
    it("writes the fetched catalog body at cacheDir/.claude-plugin/marketplace.json", async () => {
      const spy = recordingCatalog(ABSOLUTE_CATALOG_JSON);
      const fsAdapter = makeSpyFileAdapter();
      const uc = new FetchMarketplaceSource({
        pluginFetcher: new FixturePluginFetcher(),
        rawCatalog: { fetcher: spy.fetcher, fs: fsAdapter },
      });

      await uc.execute({ marketplace: makeGitHubMarketplace("v3.9.0"), cacheDir: CACHE_DIR });

      expect(await fsAdapter.readFile(CATALOG_FILE_PATH)).toBe(ABSOLUTE_CATALOG_JSON);
    });
  });

  describe("github source with relative plugin sources (probe trips)", () => {
    it("calls deleteFile on the raw marketplace.json before falling back to pluginFetcher", async () => {
      const spy = recordingCatalog(RELATIVE_CATALOG_JSON);
      const fetcher = new FixturePluginFetcher({
        '{"kind":"github","repo":"owner/repo"}': FALLBACK_PATH,
      });
      const fsAdapter = makeSpyFileAdapter({ [CATALOG_FILE_PATH]: RELATIVE_CATALOG_JSON });
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: { fetcher: spy.fetcher, fs: fsAdapter },
      });

      await uc.execute({ marketplace: makeGitHubMarketplace(), cacheDir: CACHE_DIR });

      expect(fsAdapter.deletedFiles).toContain(CATALOG_FILE_PATH);
    });

    it("returns the path from pluginFetcher fallback (subdir), not cacheDir", async () => {
      const spy = recordingCatalog(RELATIVE_CATALOG_JSON);
      const fetcher = new FixturePluginFetcher({
        '{"kind":"github","repo":"owner/repo"}': FALLBACK_PATH,
      });
      const fsAdapter = makeSpyFileAdapter({ [CATALOG_FILE_PATH]: RELATIVE_CATALOG_JSON });
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: { fetcher: spy.fetcher, fs: fsAdapter },
      });

      const result = await uc.execute({
        marketplace: makeGitHubMarketplace(),
        cacheDir: CACHE_DIR,
      });

      expect(result).toBe(FALLBACK_PATH);
    });

    it("invokes pluginFetcher.fetch with the marketplace github source", async () => {
      const spy = recordingCatalog(RELATIVE_CATALOG_JSON);
      const fetchSpy = vi.fn().mockResolvedValue(FALLBACK_PATH);
      const fetcher = new FixturePluginFetcher();
      fetcher.fetch = fetchSpy;
      const fsAdapter = makeSpyFileAdapter({ [CATALOG_FILE_PATH]: RELATIVE_CATALOG_JSON });
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: { fetcher: spy.fetcher, fs: fsAdapter },
      });

      await uc.execute({ marketplace: makeGitHubMarketplace("HEAD"), cacheDir: CACHE_DIR });

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "github", repo: "owner/repo" }),
        CACHE_DIR,
        undefined
      );
    });
  });

  describe("github source with absolute-only plugin sources (probe does not trip)", () => {
    it("returns cacheDir without calling pluginFetcher.fetch", async () => {
      const spy = recordingCatalog();
      const fetchSpy = vi.fn().mockResolvedValue(FALLBACK_PATH);
      const fetcher = new FixturePluginFetcher();
      fetcher.fetch = fetchSpy;
      const fsAdapter = makeSpyFileAdapter({ [CATALOG_FILE_PATH]: ABSOLUTE_CATALOG_JSON });
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: { fetcher: spy.fetcher, fs: fsAdapter },
      });

      const result = await uc.execute({
        marketplace: makeGitHubMarketplace(),
        cacheDir: CACHE_DIR,
      });

      expect(result).toBe(CACHE_DIR);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(fsAdapter.deletedFiles).toHaveLength(0);
    });
  });

  describe("probe error handling (fail-open)", () => {
    it("returns cacheDir when catalog file contains invalid JSON", async () => {
      const spy = recordingCatalog("not-json");
      const fetchSpy = vi.fn();
      const fetcher = new FixturePluginFetcher();
      fetcher.fetch = fetchSpy;
      const fsAdapter = makeSpyFileAdapter({ [CATALOG_FILE_PATH]: "not-json" });
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: { fetcher: spy.fetcher, fs: fsAdapter },
      });

      const result = await uc.execute({
        marketplace: makeGitHubMarketplace(),
        cacheDir: CACHE_DIR,
      });

      expect(result).toBe(CACHE_DIR);
      expect(fetchSpy).not.toHaveBeenCalled();
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
      const uc = new FetchMarketplaceSource({
        pluginFetcher: fetcher,
        rawCatalog: unusedRawCatalog(),
      });

      await uc.execute({
        marketplace: makeLocalMarketplace(),
        cacheDir: CACHE_DIR,
        fetchOptions: { forceRefresh: true },
      });

      expect(calls[0]?.forceRefresh).toBe(true);
    });
  });
});
