import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd restore", () => {
  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      const { stderr, exitCode } = await runCli(["restore", "--force"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
    } finally {
      await cleanup();
    }
  });

  it("reports 'Nothing to restore' when no files are modified", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["restore", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to restore");
    } finally {
      await cleanup();
    }
  });

  it("restores a modified file with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
      const originalContent = await readFile(namingPath, "utf-8");
      const customContent = "custom content that should be restored";
      await writeFile(namingPath, customContent, "utf-8");

      const { stdout, exitCode } = await runCli(["restore", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const afterContent = await readFile(namingPath, "utf-8");
      expect(afterContent).toBe(originalContent);
    } finally {
      await cleanup();
    }
  });

  it("recreates a deleted file with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
      await rm(namingFilePath, { force: true });
      expect(existsSync(namingFilePath)).toBe(false);

      const { stdout, exitCode } = await runCli(["restore", "--force"], projectDir);

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const agentPath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "agents",
        "code-reviewer.md"
      );
      const namingFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );

      const customAgentContent = "custom agent content";
      const customNamingContent = "custom naming content";
      await writeFile(agentPath, customAgentContent, "utf-8");
      await writeFile(namingFilePath, customNamingContent, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", ".claude/plugins/aidd-test/agents/code-reviewer.md", "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const agentAfter = await readFile(agentPath, "utf-8");
      expect(agentAfter).not.toBe(customAgentContent);

      const namingAfter = await readFile(namingFilePath, "utf-8");
      expect(namingAfter).toBe(customNamingContent);
    } finally {
      await cleanup();
    }
  });

  it("--tool flag limits restore scope to specified tool only", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const claudePluginPath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
      const untrackedPath = join(projectDir, "AGENTS.md");
      await writeFile(claudePluginPath, "modified claude plugin");
      await writeFile(untrackedPath, "modified agents");

      const { exitCode, stdout } = await runCli(
        ["restore", "--tool", "claude", "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");

      const claudeContent = await readFile(claudePluginPath, "utf-8");
      const untrackedContent = await readFile(untrackedPath, "utf-8");
      expect(claudeContent).not.toBe("modified claude plugin");
      expect(untrackedContent).toBe("modified agents");
    } finally {
      await cleanup();
    }
  });

  it("restores all files in a directory when directory prefix is given", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const namingFilePath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );

      const customClaudeContent = "custom claude content";
      const customNamingContent = "custom naming content";
      await writeFile(claudeMdPath, customClaudeContent, "utf-8");
      await writeFile(namingFilePath, customNamingContent, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", ".claude/plugins/aidd-test/rules/", "--force"],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const untrackedPath = join(projectDir, ".claude", "user-extra.md");
      await writeFile(untrackedPath, "user added file");

      const { exitCode } = await runCli(["restore", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(existsSync(untrackedPath)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("restores plugin files in non-interactive mode without --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await writeFile(
        join(projectDir, ".claude", "plugins", "aidd-test", "rules", "01-standards", "naming.md"),
        "modified content"
      );

      const { stdout, exitCode } = await runCli(["restore"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Restored");
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

  it("rejects the legacy --release flag (removed)", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore-release");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(
        ["restore", "--release", "v3.9.0", "--force"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/unknown option/i);
    } finally {
      await cleanup();
    }
  });
});
