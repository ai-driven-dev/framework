import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd status", () => {
  it("reports all files in sync after a fresh install", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await rm(join(projectDir, "CLAUDE.md"), { force: true });

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/-\s+CLAUDE\.md/);
    } finally {
      await cleanup();
    }
  });

  it("reports an untracked file in tool directory as added", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await writeFile(join(projectDir, ".claude", "untracked-file.md"), "extra content", "utf-8");

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("+");
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
      await initProject(projectDir, FRAMEWORK_PATH);

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

  it("filters status output to docs only with --docs", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // modify a docs file to create drift
      const trackedPath = join(projectDir, "aidd_docs", "tasks", ".gitkeep");
      await writeFile(trackedPath, "modified docs", "utf-8");

      const { stdout, exitCode } = await runCli(["status", "--docs"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("docs");
      expect(stdout).not.toContain("claude");
    } finally {
      await cleanup();
    }
  });

  it("exits with error when category and --docs are both specified", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["status", "ai", "--docs"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("mutually exclusive");
    } finally {
      await cleanup();
    }
  });

  it("status ai filters to only AI tools when claude is installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("status-ai-filter");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["status", "ai"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("All files are in sync");
    } finally {
      await cleanup();
    }
  });

  it("status ide reports in sync when no IDE tools are installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("status-ide-none");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["status", "ide"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("All files are in sync");
    } finally {
      await cleanup();
    }
  });

  it("status ai shows drift only for AI tools when AI file is modified", async () => {
    const { projectDir, cleanup } = await createTestEnv("status-ai-drift");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await writeFile(join(projectDir, "CLAUDE.md"), "tampered content", "utf-8");

      const { stdout, exitCode } = await runCli(["status", "ai"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("~");
    } finally {
      await cleanup();
    }
  });

  it("reports all files in sync after a fresh codex install", async () => {
    const { projectDir, cleanup } = await createTestEnv("status");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "codex", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("All files are in sync");
    } finally {
      await cleanup();
    }
  });

  it("status with unknown category exits with error", async () => {
    const { projectDir, cleanup } = await createTestEnv("status-bad-category");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["status", "unknown"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Invalid category");
    } finally {
      await cleanup();
    }
  });
});
