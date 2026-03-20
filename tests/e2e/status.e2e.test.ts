import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd status", () => {
  it("reports all files in sync after a fresh install", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("All files are in sync");
    } finally {
      await cleanup();
    }
  });

  it("reports a modified file as drifted", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      await writeFile(join(projectDir, "CLAUDE.md"), "modified content by user", "utf-8");

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("~");
    } finally {
      await cleanup();
    }
  });

  it("reports a deleted file as missing", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      await rm(join(projectDir, "CLAUDE.md"), { force: true });

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/-\s+CLAUDE\.md/);
    } finally {
      await cleanup();
    }
  });

  it("filters status output to a specific tool with --tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["status", "--tool", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("All files are in sync");
      expect(stdout).not.toContain("cursor");
    } finally {
      await cleanup();
    }
  });

  it("reports an untracked file in tool directory as added", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      await writeFile(join(projectDir, ".claude", "untracked-file.md"), "extra content", "utf-8");

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("+");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when --tool receives an unrecognized tool ID", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      const { stderr, exitCode } = await runCli(["status", "--tool", "unknown-tool"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("reports error when --tool specifies a valid but uninstalled tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      // init only (no install)
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stderr, exitCode } = await runCli(["status", "--tool", "cursor"], projectDir);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("cursor"); // mentions the tool in error
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when the project is not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      const { stderr, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
      expect(stderr).toContain("aidd setup");
    } finally {
      await cleanup();
    }
  });

  it("uses custom --repo in NoManifestError when project is not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      const { stderr, exitCode } = await runCli(
        ["--repo", "myorg/my-framework", "status"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("myorg/my-framework");
    } finally {
      await cleanup();
    }
  });

  it("reports docs drift when no tools are installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      // aidd_docs/tasks/.gitkeep is a tracked docs file in the test fixture
      const trackedPath = join(projectDir, "aidd_docs", "tasks", ".gitkeep");
      await writeFile(trackedPath, "modified", "utf-8");

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("docs");
      expect(stdout).toContain("~");
    } finally {
      await cleanup();
    }
  });
});
