import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ForeignSchemaValidationError,
  InvalidPluginManifestError,
} from "../../../src/domain/errors.js";
import { FileAdapter } from "../../../src/infrastructure/adapters/file-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");
const CURSOR_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/cursor-format");
const COPILOT_FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins/copilot-format");

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
