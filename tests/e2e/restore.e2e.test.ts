import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLI_PATH,
  createTestEnv,
  execFileAsync,
  FRAMEWORK_PATH,
  initProject,
  runCli,
} from "./helpers.js";

async function runCliNoAuth(
  args: string[],
  cwd: string,
  fakeHome: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: fakeHome };
  delete env.AIDD_TOKEN;
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], { cwd, env });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

describe.concurrent("E2E: aidd restore", () => {
  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      const { stderr, exitCode } = await runCli(["restore", "--path", FRAMEWORK_PATH], projectDir);

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

      const { stdout, exitCode } = await runCli(
        ["restore", "--path", FRAMEWORK_PATH, "--force"],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const originalContent = await readFile(claudeMdPath, "utf-8");
      const customContent = "custom content that should be restored";
      await writeFile(claudeMdPath, customContent, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["restore", "--path", FRAMEWORK_PATH, "--force"],
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

      const { stdout, exitCode } = await runCli(
        ["restore", "--path", FRAMEWORK_PATH, "--force"],
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
        ["restore", "CLAUDE.md", "--path", FRAMEWORK_PATH, "--force"],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const claudeMdPath = join(projectDir, "CLAUDE.md");
      const agentsMdPath = join(projectDir, "AGENTS.md");
      await writeFile(claudeMdPath, "modified claude");
      await writeFile(agentsMdPath, "modified agents");

      const { exitCode, stdout } = await runCli(
        ["restore", "--tool", "claude", "--force", "--path", FRAMEWORK_PATH],
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
        ["restore", ".claude/plugins/aidd-test/rules/", "--path", FRAMEWORK_PATH, "--force"],
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

      const { exitCode } = await runCli(
        ["restore", "--path", FRAMEWORK_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(untrackedPath)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("fails with '--force' hint when modified files exist in non-interactive mode", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await writeFile(join(projectDir, "CLAUDE.md"), "user modified content");

      const { stderr, exitCode } = await runCli(["restore", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--force");
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

  it("rejects the legacy --docs flag", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore");
    try {
      const { stderr, exitCode } = await runCli(
        ["restore", "--docs", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/unknown option/i);
    } finally {
      await cleanup();
    }
  });

  it("--release flag without --path triggers remote resolution and requires auth", async () => {
    const { projectDir, cleanup } = await createTestEnv("restore-release");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const fakeHome = join(projectDir, "fake-home");
      await mkdir(fakeHome, { recursive: true });

      const { stderr, exitCode } = await runCliNoAuth(
        ["restore", "--release", "v3.9.0", "--force"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/not authenticated|auth login/i);
    } finally {
      await cleanup();
    }
  });
});
