import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    it("persists and restores manifest without data loss", async () => {
      const manifest = Manifest.create("my_docs");
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded).not.toBeNull();
      expect(loaded?.docsDir).toBe("my_docs");
      expect(loaded?.getInstalledToolIds()).toHaveLength(0);
    });

    it("preserves custom docs directory in persisted manifest", async () => {
      const manifest = Manifest.create("custom_docs");
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded?.docsDir).toBe("custom_docs");
    });
  });

  describe("delete()", () => {
    it("deletes manifest file from disk", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      const result = await adapter.load();
      expect(result).toBeNull();
    });

    it("prunes empty .aidd/ directory after manifest deletion", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      const { existsSync } = await import("node:fs");
      const aiddDir = join(tempDir, ".aidd");
      expect(existsSync(aiddDir)).toBe(false);
    });

    it("silently succeeds when no manifest to delete", async () => {
      await expect(adapter.delete()).resolves.toBeUndefined();
    });
  });

  describe("manifest persistence", () => {
    it("creates .aidd/ directory if it does not exist", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, ".aidd", "manifest.json"))).toBe(true);
    });
  });

  describe("manifest migration on load", () => {
    it("migrates v0 manifest and writes v1 schema to disk", async () => {
      const aiddDir = join(tempDir, ".aidd");
      await mkdir(aiddDir, { recursive: true });
      const v0Manifest = JSON.stringify({
        docsDir: "aidd_docs",
        tools: {},
        docs: null,
      });
      await writeFile(join(aiddDir, "manifest.json"), v0Manifest, "utf-8");

      const loaded = await adapter.load();
      expect(loaded).not.toBeNull();

      // After migration, file on disk should have version: 1
      const raw = await readFile(join(aiddDir, "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      expect(data.version).toBe(1);
    });

    it("loads current manifest (version=1) without migration", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded).not.toBeNull();
      expect(loaded?.docsDir).toBe(manifest.docsDir);
      expect(loaded?.getInstalledToolIds()).toHaveLength(0);
    });

    it("migrated v0 manifest is readable with current schema", async () => {
      const aiddDir = join(tempDir, ".aidd");
      await mkdir(aiddDir, { recursive: true });
      const v0Manifest = JSON.stringify({
        docsDir: "aidd_docs",
        tools: {},
        docs: null,
      });
      await writeFile(join(aiddDir, "manifest.json"), v0Manifest, "utf-8");

      const loaded = await adapter.load();
      expect(loaded).not.toBeNull();
      expect(loaded?.docsDir).toBe("aidd_docs");

      // Verify migration wrote version=1 to disk
      const raw = await readFile(join(aiddDir, "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      expect(data.version).toBe(1);
    });
  });
});
