import { existsSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, FRAMEWORK_V2_PATH, runCli } from "./helpers.js";

// framework-v2 vs framework changes:
//   changed: rules/01-standards/naming.md (added "Constants: UPPER_SNAKE_CASE" line)
//   added:   commands/04_code/assert.md
//   removed: agents/code-reviewer.md

describe.concurrent("E2E: aidd update", () => {
  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      const { stderr, exitCode } = await runCli(
        ["update", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
    } finally {
      await cleanup();
    }
  });

  it("reports 'Already up to date' when same version is installed and no files changed", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["update", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Already up to date");
    } finally {
      await cleanup();
    }
  });

  it("applies added and changed files when updating to a newer framework", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["update", "--framework", FRAMEWORK_V2_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Updated \d+ files/);
      // new file from v2
      expect(existsSync(join(projectDir, ".claude", "commands", "aidd", "04", "assert.md"))).toBe(
        true
      );
      // changed file from v2
      const naming = await readFile(
        join(projectDir, ".claude", "rules", "01-standards", "naming.md"),
        "utf-8"
      );
      expect(naming).toContain("UPPER_SNAKE_CASE");
    } finally {
      await cleanup();
    }
  });

  it("removes files that no longer exist in the newer framework", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      // agent exists after v1 install
      expect(existsSync(join(projectDir, ".claude", "agents", "code-reviewer.md"))).toBe(true);

      await runCli(["update", "--framework", FRAMEWORK_V2_PATH], projectDir);

      // agent removed in v2
      expect(existsSync(join(projectDir, ".claude", "agents", "code-reviewer.md"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("creates a .backup when updating a user-modified file", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const namingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(namingPath, "# my custom naming rules\n");

      const { stdout, exitCode } = await runCli(
        ["update", "--framework", FRAMEWORK_V2_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Updated \d+ files/);

      const rulesDir = join(projectDir, ".claude", "rules", "01-standards");
      const backupFile = readdirSync(rulesDir).find((f) => f.startsWith("naming.md.bak."));
      expect(backupFile).toBeDefined();
      const backupPath = join(rulesDir, backupFile as string);

      const backupContent = await readFile(backupPath, "utf-8");
      expect(backupContent).toBe("# my custom naming rules\n");

      // new content from v2 was applied
      const updatedContent = await readFile(namingPath, "utf-8");
      expect(updatedContent).toContain("UPPER_SNAKE_CASE");
    } finally {
      await cleanup();
    }
  });

  it("does not write files with --dry-run but shows what would change", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const namingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      const contentBefore = await readFile(namingPath, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["update", "--framework", FRAMEWORK_V2_PATH, "--dry-run"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dry run");

      // section header format: "\nclaude (v<version>):" and "\ndocs (v<version>):"
      expect(stdout).toMatch(/claude \(v[^)]+\):/);
      expect(stdout).toMatch(/docs \(v[^)]+\):/);

      const contentAfter = await readFile(namingPath, "utf-8");
      expect(contentAfter).toBe(contentBefore);
      expect(existsSync(join(projectDir, ".claude", "commands", "aidd", "04", "assert.md"))).toBe(
        false
      );
    } finally {
      await cleanup();
    }
  });

  it("overwrites conflicts without prompting with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const namingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(namingPath, "# my custom naming rules\n");

      const { exitCode } = await runCli(
        ["update", "--framework", FRAMEWORK_V2_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(namingPath, "utf-8");
      expect(content).toContain("UPPER_SNAKE_CASE");
    } finally {
      await cleanup();
    }
  });

  it("updates docs files when upgrading to a newer framework", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { exitCode } = await runCli(["update", "--framework", FRAMEWORK_V2_PATH], projectDir);

      expect(exitCode).toBe(0);

      // README.md was changed in v2 (added "v2 Update" section)
      const readmePath = join(projectDir, "aidd_docs", "README.md");
      const content = await readFile(readmePath, "utf-8");
      expect(content).toContain("v2 Update");
    } finally {
      await cleanup();
    }
  });

  it("shows usage with --help", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      const { stdout, exitCode } = await runCli(["update", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("update");
    } finally {
      await cleanup();
    }
  });

  it("updates memory script when framework has a newer version", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const v1Content = await readFile(
        join(projectDir, ".aidd", "scripts", "update_memory.mjs"),
        "utf-8"
      );

      await runCli(["update", "--framework", FRAMEWORK_V2_PATH], projectDir);

      const v2Content = await readFile(
        join(projectDir, ".aidd", "scripts", "update_memory.mjs"),
        "utf-8"
      );

      expect(v1Content).not.toBe(v2Content);
    } finally {
      await cleanup();
    }
  });
});
