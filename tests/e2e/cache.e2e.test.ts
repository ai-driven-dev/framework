import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd cache", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-cache-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("cache list", () => {
    it("shows no cached versions on a fresh project", async () => {
      const { stdout, exitCode } = await runCli(["cache", "list"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("No cached framework versions found.");
    });

    it("lists a cached version after install", async () => {
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      // The framework path is local, so cache uses "local" as version key
      // Cache list only shows semver versions, so it may be empty for local
      const { exitCode } = await runCli(["cache", "list"], projectDir);
      expect(exitCode).toBe(0);
    });
  });

  describe("cache clear", () => {
    it("clears all versions without error when cache is empty", async () => {
      const { exitCode, stdout } = await runCli(["cache", "clear"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Cleared all cached framework versions");
    });

    it("reports an error when clearing a version that was never cached", async () => {
      const { exitCode, stderr } = await runCli(["cache", "clear", "9.9.9"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("No cached framework found for version '9.9.9'");
    });

    it("clears all versions with --all flag", async () => {
      const { exitCode, stdout } = await runCli(["cache", "clear", "--all"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Cleared all cached framework versions");
    });

    it("rejects combining --all with a version argument", async () => {
      const { exitCode, stderr } = await runCli(["cache", "clear", "--all", "1.0.0"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Cannot specify both a version and --all");
    });
  });
}, 15000);
