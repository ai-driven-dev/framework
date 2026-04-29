import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InvalidPluginManifestError } from "../../../src/domain/errors.js";
import { FileSystemAdapter } from "../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");

function makeAdapter(): PluginCatalogRepositoryAdapter {
  return new PluginCatalogRepositoryAdapter(new FileSystemAdapter(new HasherAdapter()));
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
