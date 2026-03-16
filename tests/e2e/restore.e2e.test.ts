import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, createTestEnv, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd restore", () => {
  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      const { stderr, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD installation found");
    } finally {
      await cleanup();
    }
  });

  it("reports 'Nothing to restore' when no files are modified", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to restore");
    } finally {
      await cleanup();
    }
  });

  it("restores a modified file with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const originalContent = await readFile(claudeMdPath, "utf-8");
      const customContent = "custom content that should be restored";
      await writeFile(claudeMdPath, customContent, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const afterContent = await readFile(claudeMdPath, "utf-8");
      expect(afterContent).toBe(originalContent);
    } finally {
      await cleanup();
    }
  });

  it("recreates a deleted file with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const namingFilePath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await rm(namingFilePath, { force: true });
      expect(existsSync(namingFilePath)).toBe(false);

      const { stdout, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");
      expect(existsSync(namingFilePath)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("restores only a specific file when path is given as argument", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const namingFilePath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");

      const customClaudeContent = "custom claude content";
      const customNamingContent = "custom naming content";
      await writeFile(claudeMdPath, customClaudeContent, "utf-8");
      await writeFile(namingFilePath, customNamingContent, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", "CLAUDE.md", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const claudeAfter = await readFile(claudeMdPath, "utf-8");
      expect(claudeAfter).not.toBe(customClaudeContent);

      const namingAfter = await readFile(namingFilePath, "utf-8");
      expect(namingAfter).toBe(customNamingContent);
    } finally {
      await cleanup();
    }
  });

  it("--tool flag limits restore scope to specified tool only", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const agentsMdPath = join(projectDir, "AGENTS.md");
      await writeFile(claudeMdPath, "modified claude");
      await writeFile(agentsMdPath, "modified agents");

      const { exitCode, stdout } = await runCli(
        ["restore", "--tool", "claude", "--force", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const claudeContent = await readFile(claudeMdPath, "utf-8");
      const agentsContent = await readFile(agentsMdPath, "utf-8");
      expect(claudeContent).not.toBe("modified claude");
      expect(agentsContent).toBe("modified agents");
    } finally {
      await cleanup();
    }
  });

  it("restores all files in a directory when directory prefix is given", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const namingFilePath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");

      const customClaudeContent = "custom claude content";
      const customNamingContent = "custom naming content";
      await writeFile(claudeMdPath, customClaudeContent, "utf-8");
      await writeFile(namingFilePath, customNamingContent, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", ".claude/rules/", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const claudeAfter = await readFile(claudeMdPath, "utf-8");
      expect(claudeAfter).toBe(customClaudeContent);

      const namingAfter = await readFile(namingFilePath, "utf-8");
      expect(namingAfter).not.toBe(customNamingContent);
    } finally {
      await cleanup();
    }
  });

  it("preserves untracked files in tool directory during restore", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const untrackedPath = join(projectDir, ".claude", "rules", "user-extra.md");
      await writeFile(untrackedPath, "user added file");

      const { exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(untrackedPath)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("fails with 'Restore requires --force' in non-interactive mode", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Restore requires --force in non-interactive mode");
    } finally {
      await cleanup();
    }
  });

  it("restores a deleted docs file with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const readmePath = join(projectDir, "aidd_docs", "README.md");
      await rm(readmePath, { force: true });
      expect(existsSync(readmePath)).toBe(false);

      const { stdout, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");
      expect(existsSync(readmePath)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("restores a modified docs file with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const readmePath = join(projectDir, "aidd_docs", "README.md");
      const originalContent = await readFile(readmePath, "utf-8");
      await writeFile(readmePath, "custom docs content", "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", "--framework", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const afterContent = await readFile(readmePath, "utf-8");
      expect(afterContent).toBe(originalContent);
    } finally {
      await cleanup();
    }
  });

  it("shows usage with --help", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      const { stdout, exitCode } = await runCli(["restore", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("restore");
    } finally {
      await cleanup();
    }
  });
});
