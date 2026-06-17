import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ForeignSchemaValidationError,
  InvalidPluginManifestError,
  MalformedMarketplaceCatalogError,
} from "../../../src/domain/errors.js";
import { FileAdapter } from "../../../src/infrastructure/adapters/file-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");
const CURSOR_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/cursor-format");
const CODEX_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/codex-format");
const COPILOT_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/copilot-format");
const OPENCODE_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/opencode-format");

function makeAdapter(): PluginCatalogRepositoryAdapter {
  return new PluginCatalogRepositoryAdapter(new FileAdapter(new HasherAdapter()));
}

describe("PluginCatalogRepositoryAdapter", () => {
  describe("marketplace-sample fixture", () => {
    it("returns a catalog with two entries", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(FIXTURE_DIR, "marketplace-sample"));
      expect(catalog).not.toBeNull();
      expect(catalog?.plugins).toHaveLength(2);
    });

    it("first entry has recommended true", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(FIXTURE_DIR, "marketplace-sample"));
      expect(catalog?.plugins[0].recommended).toBe(true);
    });

    it("second entry has recommended false", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(FIXTURE_DIR, "marketplace-sample"));
      expect(catalog?.plugins[1].recommended).toBe(false);
    });

    it("resolves relative local source path against framework directory", async () => {
      const adapter = makeAdapter();
      const frameworkDir = join(FIXTURE_DIR, "marketplace-sample");
      const catalog = await adapter.load(frameworkDir);
      expect(catalog?.plugins[0].source).toEqual({
        kind: "local",
        path: join(frameworkDir, "plugins/dev"),
      });
    });

    it("parses github source for second entry", async () => {
      const adapter = makeAdapter();
      const catalog = await adapter.load(join(FIXTURE_DIR, "marketplace-sample"));
      expect(catalog?.plugins[1].source).toEqual({
        kind: "github",
        repo: "ai-driven-dev/aidd-pm",
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
    it("throws InvalidPluginManifestError for invalid JSON", async () => {
      const adapter = makeAdapter();
      await expect(adapter.load(join(FIXTURE_DIR, "marketplace-malformed"))).rejects.toThrow(
        InvalidPluginManifestError
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
    it("throws InvalidPluginManifestError for invalid JSON in .plugin/marketplace.json", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.load(join(COPILOT_FIXTURE_DIR, "marketplace-multi-malformed"))
      ).rejects.toThrow(InvalidPluginManifestError);
    });
  });
});

describe("PluginCatalogRepositoryAdapter.loadForeign", () => {
  describe("cursor marketplace-sample fixture", () => {
    it("returns three normalized plugins", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CURSOR_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins).toHaveLength(3);
    });

    it("first plugin has name, version and description", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CURSOR_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[0]).toEqual({
        name: "cursor-dev-tools",
        version: "1.2.0",
        description: "Developer tools for Cursor",
        source: "cursor",
      });
    });

    it("plugin without version has name and description only", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CURSOR_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[1]).toEqual({
        name: "cursor-testing",
        description: "Testing utilities",
        source: "cursor",
      });
    });

    it("minimal plugin has name and source only", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CURSOR_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[2]).toEqual({ name: "cursor-minimal", source: "cursor" });
    });
  });

  describe("cursor marketplace-empty fixture", () => {
    it("returns empty array when plugins list is empty", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CURSOR_FIXTURE_DIR, "marketplace-empty"));
      expect(plugins).toEqual([]);
    });
  });

  describe("cursor marketplace-malformed fixture", () => {
    it("throws ForeignSchemaValidationError for invalid JSON", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.loadForeign(join(CURSOR_FIXTURE_DIR, "marketplace-malformed"))
      ).rejects.toThrow(ForeignSchemaValidationError);
    });
  });

  describe("no marketplace.json present", () => {
    it("returns empty array when no cursor marketplace exists", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(FIXTURE_DIR, "marketplace-missing"));
      expect(plugins).toEqual([]);
    });
  });
});

describe("PluginCatalogRepositoryAdapter.loadForeign (Codex)", () => {
  describe("codex marketplace-sample fixture", () => {
    it("returns three normalized plugins", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CODEX_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins).toHaveLength(3);
    });

    it("first plugin has name, version and description", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CODEX_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[0]).toEqual({
        name: "codex-dev-tools",
        version: "1.2.0",
        description: "Developer tools for Codex",
        source: "codex",
      });
    });

    it("plugin without version has name and description only", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CODEX_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[1]).toEqual({
        name: "codex-testing",
        description: "Testing utilities",
        source: "codex",
      });
    });

    it("minimal plugin has name and source only", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CODEX_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[2]).toEqual({ name: "codex-minimal", source: "codex" });
    });
  });

  describe("codex marketplace-empty fixture", () => {
    it("returns empty array when plugins list is empty", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(CODEX_FIXTURE_DIR, "marketplace-empty"));
      expect(plugins).toEqual([]);
    });
  });

  describe("codex marketplace-malformed fixture", () => {
    it("throws ForeignSchemaValidationError for invalid JSON", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.loadForeign(join(CODEX_FIXTURE_DIR, "marketplace-malformed"))
      ).rejects.toThrow(ForeignSchemaValidationError);
    });
  });

  describe("no codex marketplace.json present", () => {
    it("returns empty array when no codex marketplace exists", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(FIXTURE_DIR, "marketplace-missing"));
      expect(plugins).toEqual([]);
    });
  });
});

describe("PluginCatalogRepositoryAdapter.loadForeign (Copilot)", () => {
  describe("copilot marketplace-sample fixture", () => {
    it("returns one normalized plugin", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(COPILOT_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins).toHaveLength(1);
    });

    it("plugin has name, version and description", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(COPILOT_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[0]).toEqual({
        name: "copilot-dev-tools",
        version: "2.0.0",
        description: "Developer tools for Copilot",
        source: "copilot",
      });
    });
  });

  describe("copilot marketplace-minimal fixture", () => {
    it("returns plugin with name and source only", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(COPILOT_FIXTURE_DIR, "marketplace-minimal"));
      expect(plugins[0]).toEqual({ name: "copilot-minimal", source: "copilot" });
    });
  });

  describe("copilot marketplace-malformed fixture", () => {
    it("throws ForeignSchemaValidationError for invalid JSON", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.loadForeign(join(COPILOT_FIXTURE_DIR, "marketplace-malformed"))
      ).rejects.toThrow(ForeignSchemaValidationError);
    });
  });

  describe("no copilot plugin.json present", () => {
    it("returns empty array when no copilot plugin.json exists", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(FIXTURE_DIR, "marketplace-missing"));
      expect(plugins).toEqual([]);
    });
  });
});

describe("PluginCatalogRepositoryAdapter.loadForeign (OpenCode)", () => {
  describe("opencode marketplace-sample fixture", () => {
    it("returns three normalized plugins", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins).toHaveLength(3);
    });

    it("first plugin is bare string specifier", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[0]).toEqual({ name: "opencode-dev-tools", source: "opencode" });
    });

    it("second plugin is scoped npm package specifier", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[1]).toEqual({ name: "@my-org/opencode-testing", source: "opencode" });
    });

    it("third plugin comes from tuple, name is first element", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-sample"));
      expect(plugins[2]).toEqual({ name: "opencode-minimal", source: "opencode" });
    });

    it("no plugin has version or description", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-sample"));
      for (const p of plugins) {
        expect(p.version).toBeUndefined();
        expect(p.description).toBeUndefined();
      }
    });
  });

  describe("opencode marketplace-empty fixture", () => {
    it("returns empty array when plugin list is empty", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-empty"));
      expect(plugins).toEqual([]);
    });
  });

  describe("opencode marketplace-no-plugin-key fixture", () => {
    it("returns empty array when plugin field is absent", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(
        join(OPENCODE_FIXTURE_DIR, "marketplace-no-plugin-key")
      );
      expect(plugins).toEqual([]);
    });
  });

  describe("opencode marketplace-malformed fixture", () => {
    it("throws ForeignSchemaValidationError for invalid JSON", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.loadForeign(join(OPENCODE_FIXTURE_DIR, "marketplace-malformed"))
      ).rejects.toThrow(ForeignSchemaValidationError);
    });
  });

  describe("no opencode.json present", () => {
    it("returns empty array when no opencode.json exists", async () => {
      const adapter = makeAdapter();
      const plugins = await adapter.loadForeign(join(FIXTURE_DIR, "marketplace-missing"));
      expect(plugins).toEqual([]);
    });
  });
});

// Regression: a user (framework 4.4.1, claude) hit a cryptic
// `Invalid plugin manifest: "plugins" must be an array` crash when a cached
// marketplace.json held a non-array object (stale / interrupted fetch).
// The catalog reader must surface an actionable, recovery-bearing error
// instead, and the hint must differ for cache vs user-provided sources.
describe("PluginCatalogRepositoryAdapter.load — malformed catalog recovery", () => {
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
      await expect(adapter.load(cacheDir)).rejects.toThrow(/marketplace refresh --force/);
      // Backward-compat: still an InvalidPluginManifestError for existing catchers.
      await expect(adapter.load(cacheDir)).rejects.toThrow(InvalidPluginManifestError);
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
      await expect(adapter.load(cacheDir)).rejects.toThrow(/marketplace refresh --force/);
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
      await expect(adapter.load(tmp)).rejects.toThrow(/Fix or re-create/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
