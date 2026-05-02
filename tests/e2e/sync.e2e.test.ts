import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd sync", () => {
  it("exits with error when --source receives an unrecognized tool ID", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["sync", "--source", "unknown-tool"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("exits with error when --target receives an unrecognized tool ID", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "unknown-tool"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      const { stderr, exitCode } = await runCli(["sync", "--source", "claude"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
    } finally {
      await cleanup();
    }
  });

  it("fails when source tool is not installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "copilot", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["sync", "--source", "claude"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("claude");
    } finally {
      await cleanup();
    }
  });

  it("fails with 'at least 2 installed tools' when only claude is installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["sync", "--source", "claude"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("at least 2 installed tools");
    } finally {
      await cleanup();
    }
  });

  it("fails when source and target are the same tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "claude"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("same tool");
    } finally {
      await cleanup();
    }
  });

  it("reports nothing to sync when claude has no modifications", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["sync", "--source", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to sync");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — plugin files have no frameworkPath, cross-tool sync impossible without model change
  it.skip("syncs a modified rule file from claude to cursor", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(claudeNamingPath, "# Custom naming rules\nmodified content", "utf-8");

      const { stdout, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "cursor", "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Synced");

      const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
      const cursorContent = await readFile(cursorNamingPath, "utf-8");
      expect(cursorContent).toContain("Custom naming rules");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — plugin files have no frameworkPath, cross-tool sync impossible without model change
  it.skip("propagates deletion from source to target", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await rm(claudeNamingPath, { force: true });

      const { stdout, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "cursor"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("deleted");

      const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
      expect(existsSync(cursorNamingPath)).toBe(false);
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — plugin files have no frameworkPath, cross-tool sync impossible without model change
  it.skip("propagates modification from source to all installed tools when no --target is given", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "copilot", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(claudeNamingPath, "# Broadcast sync\nmodified content", "utf-8");

      const { stdout, exitCode } = await runCli(
        ["sync", "--source", "claude", "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Synced");

      const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
      const copilotNamingPath = join(
        projectDir,
        ".github",
        "instructions",
        "01-naming.instructions.md"
      );
      const cursorContent = await readFile(cursorNamingPath, "utf-8");
      const copilotContent = await readFile(copilotNamingPath, "utf-8");
      expect(cursorContent).toContain("Broadcast sync");
      expect(copilotContent).toContain("Broadcast sync");
    } finally {
      await cleanup();
    }
  });

  it("fails when target tool is installed but a different target is specified that is not installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "copilot"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("copilot");
      expect(stderr).toContain("not installed");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — plugin files have no frameworkPath, cross-tool sync impossible without model change
  it.skip("force-syncs from claude to cursor without blocking on conflict", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(claudeNamingPath, "# Force sync\noverridden content", "utf-8");

      const { stdout, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "cursor", "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Synced");

      const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
      const content = await readFile(cursorNamingPath, "utf-8");
      expect(content).toContain("Force sync");
    } finally {
      await cleanup();
    }
  });

  it("shows usage with --help", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      const { stdout, exitCode } = await runCli(["sync", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("sync");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — .claude/agents/ dir not created when agents are in plugins; user-file sync scan needs model change
  it.skip("syncs user agent from claude to cursor with --include-user-files", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const userAgentPath = join(projectDir, ".claude", "agents", "my-custom-agent.md");
      await writeFile(
        userAgentPath,
        "---\nname: my-custom-agent\ndescription: My custom agent.\n---\n\nCustom agent content.\n",
        "utf-8"
      );

      const { stdout, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "cursor", "--include-user-files"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Synced");

      const targetPath = join(projectDir, ".cursor", "agents", "my-custom-agent.md");
      const content = await readFile(targetPath, "utf-8");
      expect(content).toContain("Custom agent content.");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — plugin files have no frameworkPath, cross-tool sync impossible without model change
  it.skip("broadcasts deletion from claude to cursor and copilot when no --target is given", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "copilot", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await rm(claudeNamingPath, { force: true });

      const { stdout, exitCode } = await runCli(["sync", "--source", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("deleted");

      const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
      const copilotNamingPath = join(
        projectDir,
        ".github",
        "instructions",
        "01-naming.instructions.md"
      );
      expect(existsSync(cursorNamingPath)).toBe(false);
      expect(existsSync(copilotNamingPath)).toBe(false);
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — plugin files have no frameworkPath, cross-tool sync impossible without model change
  it.skip("syncs a modified rule from claude to copilot (framework file MODIFIED)", async () => {
    const { projectDir, cleanup } = await createTestEnv("sync");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "copilot", "--path", FRAMEWORK_PATH], projectDir);

      const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await writeFile(claudeNamingPath, "# Copilot sync test\nmodified content", "utf-8");

      const { stdout, exitCode } = await runCli(
        ["sync", "--source", "claude", "--target", "copilot", "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Synced");

      const copilotNamingPath = join(
        projectDir,
        ".github",
        "instructions",
        "01-naming.instructions.md"
      );
      const content = await readFile(copilotNamingPath, "utf-8");
      expect(content).toContain("Copilot sync test");
    } finally {
      await cleanup();
    }
  });
});
