import { existsSync, readdirSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createTestEnv,
  FRAMEWORK_PATH,
  FRAMEWORK_V2_PATH,
  initProject,
  runCli,
} from "./helpers.js";

// framework-v2 vs framework changes:
//   changed: rules/01-standards/naming.md (added "Constants: UPPER_SNAKE_CASE" line)
//   added:   commands/04_code/assert.md
//   removed: agents/code-reviewer.md

describe.concurrent("E2E: aidd update", () => {
  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      const { stderr, exitCode } = await runCli(["update", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
    } finally {
      await cleanup();
    }
  });

  it("reports 'Already up to date' when same version is installed and no files changed", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["update", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Already up to date");
    } finally {
      await cleanup();
    }
  });

  it("applies added and changed files when updating to a newer framework", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // agent exists after v1 install
      expect(existsSync(join(projectDir, ".claude", "agents", "code-reviewer.md"))).toBe(true);

      await runCli(["update", "--path", FRAMEWORK_V2_PATH], projectDir);

      // agent removed in v2
      expect(existsSync(join(projectDir, ".claude", "agents", "code-reviewer.md"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("creates a .backup when updating a user-modified file", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(namingPath, "# my custom naming rules\n");

      const { stdout, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--force"],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      const contentBefore = await readFile(namingPath, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--dry-run"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("The following changes would be applied");

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(namingPath, "# my custom naming rules\n");

      const { exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--force"],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { exitCode } = await runCli(["update", "--path", FRAMEWORK_V2_PATH], projectDir);

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const v1Content = await readFile(
        join(projectDir, ".aidd", "scripts", "update_memory.js"),
        "utf-8"
      );

      await runCli(["update", "--path", FRAMEWORK_V2_PATH], projectDir);

      const v2Content = await readFile(
        join(projectDir, ".aidd", "scripts", "update_memory.js"),
        "utf-8"
      );

      expect(v1Content).not.toBe(v2Content);
    } finally {
      await cleanup();
    }
  });

  it("exits with error when --tool and --docs are both specified", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      const { stderr, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_PATH, "--tool", "claude", "--docs"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("mutually exclusive");
    } finally {
      await cleanup();
    }
  });

  it("--tool scope updates only the specified tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const cursorNamingBefore = await readFile(
        join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc"),
        "utf-8"
      );

      const { exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--tool", "claude"],
        projectDir
      );

      expect(exitCode).toBe(0);
      // claude should have been updated (new file from v2 added)
      expect(existsSync(join(projectDir, ".claude", "commands", "aidd", "04", "assert.md"))).toBe(
        true
      );
      // cursor naming file should be unchanged
      const cursorNamingAfter = await readFile(
        join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc"),
        "utf-8"
      );
      expect(cursorNamingAfter).toBe(cursorNamingBefore);
    } finally {
      await cleanup();
    }
  });

  it("--docs scope updates only docs files", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingBefore = await readFile(
        join(projectDir, ".claude", "rules", "01-standards", "naming.md"),
        "utf-8"
      );

      const { exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--docs"],
        projectDir
      );

      expect(exitCode).toBe(0);
      // claude naming file should be unchanged (docs scope only)
      const claudeNamingAfter = await readFile(
        join(projectDir, ".claude", "rules", "01-standards", "naming.md"),
        "utf-8"
      );
      expect(claudeNamingAfter).toBe(claudeNamingBefore);
      // docs README should be updated from v2
      const readmePath = join(projectDir, "aidd_docs", "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).toContain("v2 Update");
    } finally {
      await cleanup();
    }
  });

  it("removes an obsolete script file replaced by a newer framework version", async () => {
    const { projectDir, cleanup } = await createTestEnv("update-stale-script");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // Simulate a project that was installed with an older CLI that wrote update_memory.mjs
      const manifestPath = join(projectDir, ".aidd", "manifest.json");
      const manifestRaw = JSON.parse(await readFile(manifestPath, "utf-8"));
      const staleRelPath = ".aidd/scripts/update_memory.mjs";
      const currentRelPath = ".aidd/scripts/update_memory.js";
      const currentHash = manifestRaw.scripts.files[0].hash;
      manifestRaw.scripts.files = [{ relativePath: staleRelPath, hash: currentHash }];
      await writeFile(manifestPath, JSON.stringify(manifestRaw, null, 2));

      // Move the script on disk to the stale path
      await rename(join(projectDir, currentRelPath), join(projectDir, staleRelPath));

      const { stdout, stderr, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_PATH, "--verbose"],
        projectDir
      );

      // Log everything for inspection
      process.stdout.write(`\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n`);

      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, staleRelPath))).toBe(false);
      expect(existsSync(join(projectDir, currentRelPath))).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
