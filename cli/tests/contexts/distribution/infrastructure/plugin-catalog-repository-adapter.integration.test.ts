import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MalformedMarketplaceCatalogError } from "../../../../src/contexts/distribution/domain/distribution.error.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");
const COPILOT_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/copilot-format");

function makeAdapter(): PluginCatalogRepositoryAdapter {
  return new PluginCatalogRepositoryAdapter(new FileAdapter());
}

describe("reading a plugin catalog from a marketplace", () => {
  describe("marketplace-sample fixture", () => {
    it("resolves relative local source path against framework directory", async () => {
      const adapter = makeAdapter();
      const frameworkDir = join(FIXTURE_DIR, "marketplace-sample");
      const catalog = await adapter.load(frameworkDir);
      expect(catalog?.plugins[0].source).toEqual({
        kind: "local",
        path: join(frameworkDir, "plugins/dev"),
      });
    });
  });

  describe("marketplace-missing fixture", () => {
    it("returns null when marketplace.json is absent", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(FIXTURE_DIR, "marketplace-missing"));
      expect(catalog).toBeNull();
    });
  });

  describe("marketplace-malformed fixture", () => {
    it("throws MalformedMarketplaceCatalogError for invalid JSON", async () => {
      const adapter = makeAdapter();
      await expect(adapter.load(join(FIXTURE_DIR, "marketplace-malformed"))).rejects.toThrow(
        MalformedMarketplaceCatalogError
      );
    });
  });
});

describe("PluginCatalogRepositoryAdapter.load (Copilot-native path)", () => {
  describe("copilot marketplace-multi-sample fixture", () => {
    it("returns a catalog with two entries from .plugin/marketplace.json", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(COPILOT_FIXTURE_DIR, "marketplace-multi-sample"));
      expect(catalog).not.toBeNull();
      expect(catalog?.plugins).toHaveLength(2);
    });

    it("carries the catalog name", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(COPILOT_FIXTURE_DIR, "marketplace-multi-sample"));
      expect(catalog?.name).toBe("aidd-framework");
    });

    it("resolves relative local source path against framework directory", async () => {
      const adapter = makeAdapter();
      const frameworkDir = join(COPILOT_FIXTURE_DIR, "marketplace-multi-sample");
      const catalog = await adapter.load(frameworkDir);
      expect(catalog?.plugins[0].source).toEqual({
        kind: "local",
        path: join(frameworkDir, "plugins/aidd-dev"),
      });
    });

    it("sets recommended and strict to false", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(COPILOT_FIXTURE_DIR, "marketplace-multi-sample"));
      expect(catalog?.plugins[0].recommended).toBe(false);
      expect(catalog?.plugins[0].strict).toBe(false);
    });
  });

  describe("copilot marketplace-multi-missing fixture", () => {
    it("returns null when neither .plugin/marketplace.json nor .claude-plugin/marketplace.json exists", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(COPILOT_FIXTURE_DIR, "marketplace-multi-missing"));
      expect(catalog).toBeNull();
    });
  });

  describe("copilot marketplace-multi-malformed fixture", () => {
    it("throws MalformedMarketplaceCatalogError for invalid JSON in .plugin/marketplace.json", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.load(join(COPILOT_FIXTURE_DIR, "marketplace-multi-malformed"))
      ).rejects.toThrow(MalformedMarketplaceCatalogError);
    });
  });
});

// A cached marketplace.json holding a non-array `plugins` must surface an actionable,
// recovery-bearing error, and the hint differs for a cache source and a user-provided one.
describe("PluginCatalogRepositoryAdapter.load - malformed catalog recovery", () => {
  async function writeCatalog(frameworkDir: string, content: string): Promise<void> {
    await mkdir(join(frameworkDir, ".claude-plugin"), { recursive: true });
    await writeFile(join(frameworkDir, ".claude-plugin/marketplace.json"), content, "utf-8");
  }

  it("non-array object under a cache path → MalformedMarketplaceCatalogError with refresh hint", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "aidd-catalog-cache-"));
    const cacheDir = join(tmp, ".aidd/cache/marketplaces/aidd-framework/github-x");
    await writeCatalog(cacheDir, '{"message":"API rate limit exceeded"}');
    const adapter = makeAdapter();
    try {
      await expect(adapter.load(cacheDir)).rejects.toThrow(MalformedMarketplaceCatalogError);
      await expect(adapter.load(cacheDir)).rejects.toThrow(
        expect.objectContaining({ cached: true })
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("malformed JSON under a cache path → recovery hint, never a raw JSON.parse crash", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "aidd-catalog-cache-"));
    const cacheDir = join(tmp, ".aidd/cache/marketplaces/aidd-framework/github-x");
    await writeCatalog(cacheDir, "{ not valid json");
    const adapter = makeAdapter();
    try {
      await expect(adapter.load(cacheDir)).rejects.toThrow(
        expect.objectContaining({ cached: true })
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("malformed catalog from a user-provided (non-cache) source → fix-the-file hint", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "aidd-catalog-local-"));
    await writeCatalog(tmp, '{"plugins":{}}');
    const adapter = makeAdapter();
    try {
      await expect(adapter.load(tmp)).rejects.toThrow(MalformedMarketplaceCatalogError);
      await expect(adapter.load(tmp)).rejects.toThrow(expect.objectContaining({ cached: false }));
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("PluginCatalogRepositoryAdapter.load - a framework carrying both catalogs", () => {
  it("reads the Copilot catalog and leaves the Claude one", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "aidd-catalog-both-"));
    const copilot = JSON.stringify({
      metadata: { pluginRoot: "./plugins" },
      plugins: [{ name: "from-copilot", source: "p" }],
    });
    const claude = JSON.stringify({
      plugins: [{ name: "from-claude", source: { kind: "local", path: "./p" } }],
    });
    try {
      await mkdir(join(tmp, ".plugin"), { recursive: true });
      await mkdir(join(tmp, ".claude-plugin"), { recursive: true });
      await writeFile(join(tmp, ".plugin/marketplace.json"), copilot, "utf-8");
      await writeFile(join(tmp, ".claude-plugin/marketplace.json"), claude, "utf-8");

      const catalog = await makeAdapter().load(tmp);

      expect(catalog?.plugins.map((p) => p.name)).toEqual(["from-copilot"]);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
