import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../../../src/infrastructure/auth/auth-storage.js";
import { makeAuthConfig } from "../../helpers/auth.js";

describe("AuthStorage", () => {
  let tempDir: string;
  let storage: AuthStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "auth-storage-test-"));
    storage = new AuthStorage();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("read", () => {
    it("returns null when file does not exist", async () => {
      const result = await storage.read(join(tempDir, "nonexistent.json"));
      expect(result).toBeNull();
    });

    it("returns null when file contains invalid JSON", async () => {
      const path = join(tempDir, "bad.json");
      await writeFile(path, "not json");
      const result = await storage.read(path);
      expect(result).toBeNull();
    });

    it("returns null when file contains JSON missing required fields", async () => {
      const path = join(tempDir, "incomplete.json");
      await writeFile(path, JSON.stringify({ version: 1 }));
      const result = await storage.read(path);
      expect(result).toBeNull();
    });

    it("returns AuthConfig when file is valid", async () => {
      const config = makeAuthConfig({ token: "ghp_abc123" });
      const path = join(tempDir, "auth.json");
      await writeFile(path, JSON.stringify(config));
      const result = await storage.read(path);
      expect(result).toEqual(config);
    });
  });

  describe("write", () => {
    it("creates parent directories and writes the file", async () => {
      const path = join(tempDir, "nested", "dir", "auth.json");
      const config = makeAuthConfig({ method: "gh", level: "project", token: undefined });
      await storage.write(path, config);
      const content = await readFile(path, "utf-8");
      expect(JSON.parse(content)).toEqual(config);
    });

    it("sets restrictive file permissions on non-Windows", async () => {
      if (process.platform === "win32") return;
      const path = join(tempDir, "auth.json");
      await storage.write(path, makeAuthConfig({ token: "ghp_secret" }));
      const stats = await stat(path);
      expect(stats.mode & 0o777).toBe(0o600);
    });

    it("written file can be read back", async () => {
      const path = join(tempDir, "auth.json");
      const config = makeAuthConfig({ token: "ghp_roundtrip" });
      await storage.write(path, config);
      const result = await storage.read(path);
      expect(result).toEqual(config);
    });
  });

  describe("delete", () => {
    it("removes an existing file", async () => {
      const path = join(tempDir, "auth.json");
      await writeFile(path, "{}");
      await storage.delete(path);
      await expect(readFile(path)).rejects.toThrow();
    });

    it("does not throw when file does not exist", async () => {
      await expect(storage.delete(join(tempDir, "missing.json"))).resolves.not.toThrow();
    });
  });

  describe("paths", () => {
    it("projectConfigPath returns .aidd/auth.json under projectRoot", () => {
      const path = storage.projectConfigPath("/my/project");
      expect(path).toBe("/my/project/.aidd/auth.json");
    });
  });
});
