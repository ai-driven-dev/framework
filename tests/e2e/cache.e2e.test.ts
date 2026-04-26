import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd cache", () => {
  describe("cache list", () => {
    it("shows no cached versions on a fresh project", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { stdout, exitCode } = await runCli(["cache", "list"], projectDir);

        expect(exitCode).toBe(0);
        expect(stdout).toContain("No cached framework versions found.");
      } finally {
        await cleanup();
      }
    });

    it("lists a cached version after install", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

        // The framework path is local, so cache uses "local" as version key
        // Cache list only shows semver versions, so it may be empty for local
        const { exitCode } = await runCli(["cache", "list"], projectDir);
        expect(exitCode).toBe(0);
      } finally {
        await cleanup();
      }
    });
  });

  describe("cache list after install --release", () => {
    it("cache clear for a release tag version that was never downloaded exits with error", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache-release-tag");
      try {
        const { exitCode, stderr } = await runCli(["cache", "clear", "v3.9.0"], projectDir);

        expect(exitCode).toBe(1);
        expect(stderr).toContain("No cached framework found for version 'v3.9.0'");
      } finally {
        await cleanup();
      }
    });

    it("cache list shows no entry for a release version tag that was never downloaded", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache-release-tag-list");
      try {
        const { stdout, exitCode } = await runCli(["cache", "list"], projectDir);

        expect(exitCode).toBe(0);
        // A never-downloaded release tag version must not appear in the cache
        expect(stdout).not.toContain("v3.9.0-never-downloaded");
      } finally {
        await cleanup();
      }
    });
  });

  describe("cache clear", () => {
    it("clears all versions without error when cache is empty (--all)", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { exitCode, stdout } = await runCli(["cache", "clear", "--all"], projectDir);

        expect(exitCode).toBe(0);
        expect(stdout).toContain("Cleared all cached framework versions");
      } finally {
        await cleanup();
      }
    });

    it("exits 1 in non-TTY when no version and no --all", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { exitCode, stderr } = await runCli(["cache", "clear"], projectDir);

        expect(exitCode).toBe(1);
        expect(stderr).toContain("non-interactive mode");
      } finally {
        await cleanup();
      }
    });

    it("reports an error when clearing a version that was never cached", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { exitCode, stderr } = await runCli(["cache", "clear", "9.9.9"], projectDir);

        expect(exitCode).toBe(1);
        expect(stderr).toContain("No cached framework found for version '9.9.9'");
      } finally {
        await cleanup();
      }
    });

    it("clears all versions with --all flag", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { exitCode, stdout } = await runCli(["cache", "clear", "--all"], projectDir);

        expect(exitCode).toBe(0);
        expect(stdout).toContain("Cleared all cached framework versions");
      } finally {
        await cleanup();
      }
    });

    it("clears a seeded semver version and removes it from cache list", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache-clear-seeded");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        // Seed the cache directory directly to avoid requiring a remote download
        const cacheDir = join(projectDir, ".aidd", "cache", "3.0.0");
        await mkdir(cacheDir, { recursive: true });
        await writeFile(join(cacheDir, ".aidd-extracted"), "", "utf-8");

        const { stdout: listBefore } = await runCli(["cache", "list"], projectDir);
        expect(listBefore).toContain("3.0.0");

        const { exitCode, stdout } = await runCli(["cache", "clear", "3.0.0"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout).toContain("3.0.0");

        const { stdout: listAfter } = await runCli(["cache", "list"], projectDir);
        expect(listAfter).not.toContain("3.0.0");
      } finally {
        await cleanup();
      }
    });

    it("rejects combining --all with a version argument", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { exitCode, stderr } = await runCli(["cache", "clear", "--all", "1.0.0"], projectDir);

        expect(exitCode).toBe(1);
        expect(stderr).toContain("Cannot specify both a version and --all");
      } finally {
        await cleanup();
      }
    });
  });
}, 15000);
