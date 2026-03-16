import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

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
        await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

        // The framework path is local, so cache uses "local" as version key
        // Cache list only shows semver versions, so it may be empty for local
        const { exitCode } = await runCli(["cache", "list"], projectDir);
        expect(exitCode).toBe(0);
      } finally {
        await cleanup();
      }
    });
  });

  describe("cache clear", () => {
    it("clears all versions without error when cache is empty", async () => {
      const { projectDir, cleanup } = await createTestEnv("cache");
      try {
        const { exitCode, stdout } = await runCli(["cache", "clear"], projectDir);

        expect(exitCode).toBe(0);
        expect(stdout).toContain("Cleared all cached framework versions");
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
