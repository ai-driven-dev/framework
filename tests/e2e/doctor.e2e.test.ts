import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd doctor", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-doctor-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reports a healthy installation after a fresh install", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installation is healthy");
  }, 5000);

  it("shows an error message when the manifest JSON is corrupted", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await writeFile(join(projectDir, ".aidd", "manifest.json"), "{ not valid json", "utf-8");

    const { stderr, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("corrupted");
  }, 5000);

  it("shows an error message when the project is not initialized", async () => {
    const { stderr, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 5000);

  it("reports a warning for a broken @path reference in a tracked file", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    // Overwrite a tracked .md file with a broken @path reference
    await writeFile(
      join(projectDir, ".claude", "agents", "code-reviewer.md"),
      "See @.claude/agents/nonexistent-agent.md for details",
      "utf-8"
    );

    const { stderr, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("nonexistent-agent.md");
  }, 5000);

  describe("doctor --fix", () => {
    it("restores deleted tracked files and reports healthy afterward", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { rm: rmNode, access } = await import("node:fs/promises");
      const deletedFile = join(projectDir, ".claude", "agents", "code-reviewer.md");
      await rmNode(deletedFile, { force: true });

      const { stdout, exitCode } = await runCli(
        ["doctor", "--fix", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");
      // File must be back on disk
      await expect(access(deletedFile)).resolves.toBeUndefined();
    }, 10000);

    it("reports an error when the docs directory is missing from disk", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, "aidd_docs"), { recursive: true, force: true });

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("does not exist on disk");
    }, 10000);

    it("reports orphaned directories as not auto-fixable", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      // Create an orphaned cursor directory (known tool dir, not tracked)
      const { mkdir: mkdirNode } = await import("node:fs/promises");
      await mkdirNode(join(projectDir, ".cursor"), { recursive: true });

      const { stderr, stdout } = await runCli(
        ["doctor", "--fix", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      // Should warn about orphaned directory as not auto-fixable
      const combinedOutput = stdout + stderr;
      expect(combinedOutput).toMatch(/Cannot auto-fix|Orphaned/i);
    }, 10000);
  });
});
