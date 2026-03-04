import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Manifest } from "../../../src/domain/models/manifest.js";
import { ManifestRepositoryAdapter } from "../../../src/infrastructure/adapters/manifest-repository-adapter.js";

describe("ManifestRepositoryAdapter", () => {
  let tempDir: string;
  let adapter: ManifestRepositoryAdapter;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `manifest-repo-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    adapter = new ManifestRepositoryAdapter(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("load()", () => {
    it("returns null when manifest file does not exist", async () => {
      const result = await adapter.load();
      expect(result).toBeNull();
    });
  });

  describe("save() + load() roundtrip", () => {
    it("saves manifest and loads it back correctly", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded).not.toBeNull();
    });

    it("persists manifest with docsDir", async () => {
      const manifest = Manifest.create("custom_docs");
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded?.docsDir).toBe("custom_docs");
    });
  });

  describe("delete()", () => {
    it("removes the manifest file", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      const result = await adapter.load();
      expect(result).toBeNull();
    });

    it("removes .aidd/ directory if it becomes empty after deletion", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      const { existsSync } = await import("node:fs");
      const aiddDir = join(tempDir, ".aidd");
      expect(existsSync(aiddDir)).toBe(false);
    });

    it("does not throw when manifest does not exist", async () => {
      await expect(adapter.delete()).resolves.toBeUndefined();
    });
  });

  describe("save() creates .aidd/ directory", () => {
    it("creates .aidd/ if it does not exist", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, ".aidd", "config.json"))).toBe(true);
    });
  });
});
