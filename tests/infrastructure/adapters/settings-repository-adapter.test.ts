import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsRepositoryAdapter } from "../../../src/infrastructure/adapters/settings-repository-adapter.js";

describe("SettingsRepositoryAdapter", () => {
  let tempDir: string;
  let adapter: SettingsRepositoryAdapter;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `settings-repo-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    adapter = new SettingsRepositoryAdapter(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("load() with missing file", () => {
    it("returns Settings with defaults when file does not exist", async () => {
      const settings = await adapter.load();
      expect(settings.repo).toBe("ai-driven-dev/aidd-framework");
      expect(settings.docsDir).toBe("aidd_docs");
      expect(settings.verbose).toBe(false);
    });
  });

  describe("load() with valid settings file", () => {
    it("merges file values with defaults", async () => {
      const aiddDir = join(tempDir, ".aidd");
      await mkdir(aiddDir);
      await writeFile(
        join(aiddDir, "settings.json"),
        JSON.stringify({ repo: "custom/repo", verbose: true }),
        "utf-8"
      );

      const settings = await adapter.load();
      expect(settings.repo).toBe("custom/repo");
      expect(settings.verbose).toBe(true);
      expect(settings.docsDir).toBe("aidd_docs"); // default preserved
    });

    it("ignores token key for security", async () => {
      const aiddDir = join(tempDir, ".aidd");
      await mkdir(aiddDir);
      await writeFile(
        join(aiddDir, "settings.json"),
        JSON.stringify({ token: "super-secret", repo: "safe/repo" }),
        "utf-8"
      );

      const settings = await adapter.load();
      expect(settings.repo).toBe("safe/repo");
      // Settings has no token property — confirm it wasn't loaded
      expect(Object.keys(settings)).not.toContain("token");
    });

    it("uses defaults for unrecognized or incorrectly-typed keys", async () => {
      const aiddDir = join(tempDir, ".aidd");
      await mkdir(aiddDir);
      await writeFile(
        join(aiddDir, "settings.json"),
        JSON.stringify({ repo: 42 }), // invalid type for repo
        "utf-8"
      );

      const settings = await adapter.load();
      expect(settings.repo).toBe("ai-driven-dev/aidd-framework"); // fallback to default
    });
  });

  describe("load() with invalid JSON", () => {
    it("throws descriptive error on malformed JSON", async () => {
      const aiddDir = join(tempDir, ".aidd");
      await mkdir(aiddDir);
      await writeFile(join(aiddDir, "settings.json"), "{ invalid json }", "utf-8");

      await expect(adapter.load()).rejects.toThrow("Invalid JSON in settings file");
    });
  });
});
