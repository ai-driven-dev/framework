import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: full lifecycle", () => {
  it("supports all core commands end-to-end without error", async () => {
    const { projectDir, cleanup } = await createTestEnv("lifecycle");
    try {
      // init
      const initResult = await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      expect(initResult.exitCode).toBe(0);

      // install claude and cursor
      const installClaudeResult = await runCli(
        ["install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );
      expect(installClaudeResult.exitCode).toBe(0);
      expect(installClaudeResult.stdout).toContain("Installed claude");

      const installCursorResult = await runCli(
        ["install", "cursor", "--framework", FRAMEWORK_PATH],
        projectDir
      );
      expect(installCursorResult.exitCode).toBe(0);
      expect(installCursorResult.stdout).toContain("Installed cursor");

      // status — in sync
      const statusSyncResult = await runCli(["status"], projectDir);
      expect(statusSyncResult.exitCode).toBe(0);
      expect(statusSyncResult.stdout).toContain("All files are in sync");

      // update — already up to date
      const updateResult = await runCli(["update", "--framework", FRAMEWORK_PATH], projectDir);
      expect(updateResult.exitCode).toBe(0);
      expect(updateResult.stdout).toContain("Already up to date");

      // modify CLAUDE.md
      const claudeMdPath = join(projectDir, "CLAUDE.md");
      await writeFile(claudeMdPath, "modified content", "utf-8");

      // status shows drift
      const statusDriftResult = await runCli(["status"], projectDir);
      expect(statusDriftResult.exitCode).toBe(0);
      expect(statusDriftResult.stdout).toContain("~");

      // restore --force brings it back in sync
      const restoreResult = await runCli(
        ["restore", "--force", "--framework", FRAMEWORK_PATH],
        projectDir
      );
      expect(restoreResult.exitCode).toBe(0);
      expect(restoreResult.stdout).toContain("Restored");

      // status — in sync again
      const statusAfterRestoreResult = await runCli(["status"], projectDir);
      expect(statusAfterRestoreResult.exitCode).toBe(0);
      expect(statusAfterRestoreResult.stdout).toContain("All files are in sync");

      // sync --source claude — nothing to sync (no modifications)
      const syncResult = await runCli(["sync", "--source", "claude"], projectDir);
      expect(syncResult.exitCode).toBe(0);
      expect(syncResult.stdout).toContain("Nothing to sync");

      // cache list
      const cacheListResult = await runCli(["cache", "list"], projectDir);
      expect(cacheListResult.exitCode).toBe(0);

      // clean --force
      const cleanResult = await runCli(["clean", "--force"], projectDir);
      expect(cleanResult.exitCode).toBe(0);
      expect(cleanResult.stdout).toContain("Cleaned");
      expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("cleans up all installed files after uninstall and clean", async () => {
    const { projectDir, cleanup } = await createTestEnv("lifecycle");
    try {
      // init
      const initResult = await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      expect(initResult.exitCode).toBe(0);

      // install claude
      const installResult = await runCli(
        ["install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );
      expect(installResult.exitCode).toBe(0);
      expect(installResult.stdout).toContain("Installed claude");

      // status — in sync
      const statusResult = await runCli(["status"], projectDir);
      expect(statusResult.exitCode).toBe(0);
      expect(statusResult.stdout).toContain("All files are in sync");

      // uninstall
      const uninstallResult = await runCli(["uninstall", "claude"], projectDir);
      expect(uninstallResult.exitCode).toBe(0);
      expect(uninstallResult.stdout).toContain("Uninstalled claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);

      // clean --force
      const cleanResult = await runCli(["clean", "--force"], projectDir);
      expect(cleanResult.exitCode).toBe(0);
      expect(cleanResult.stdout).toContain("Cleaned all AIDD files");
      expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
