import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCS_DIR } from "../../src/domain/models/paths.js";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd doctor", () => {
  it("reports a healthy installation after a fresh install", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installation is healthy");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when the manifest JSON is corrupted", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await writeFile(join(projectDir, ".aidd", "manifest.json"), "{ not valid json", "utf-8");

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("corrupted");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when the project is not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
    } finally {
      await cleanup();
    }
  });

  it("reports a warning for a broken @path reference in a tracked file", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await writeFile(
        join(projectDir, ".claude", "plugins", "aidd-test", "agents", "code-reviewer.md"),
        "See @.claude/agents/nonexistent-agent.md for details",
        "utf-8"
      );

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("nonexistent-agent.md");
    } finally {
      await cleanup();
    }
  });

  it("reports an error when the docs directory is missing from disk", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, DOCS_DIR), { recursive: true, force: true });

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("does not exist on disk");
    } finally {
      await cleanup();
    }
  });

  it("reports orphaned directories as a warning", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // hasToolSignals checks signalDir (.cursor/commands) for .md files with aidd: frontmatter
      await mkdir(join(projectDir, ".cursor", "commands"), { recursive: true });
      await writeFile(
        join(projectDir, ".cursor", "commands", "plan.md"),
        "---\nname: aidd:03:plan\ndescription: Plan feature\n---\nContent here.\n",
        "utf-8"
      );

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Orphaned");
    } finally {
      await cleanup();
    }
  });

  it("doctor ai filters to only AI tools and reports healthy", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor-ai-filter");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["doctor", "ai"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installation is healthy");
    } finally {
      await cleanup();
    }
  });

  it("doctor ide reports healthy when no IDE tools are installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor-ide-none");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["doctor", "ide"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installation is healthy");
    } finally {
      await cleanup();
    }
  });

  it("reports a healthy installation after a fresh codex install", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "codex", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["doctor", "ai"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installation is healthy");
    } finally {
      await cleanup();
    }
  });

  it("reports a healthy installation after a fresh vscode install", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ide", "vscode", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["doctor", "ide"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installation is healthy");
    } finally {
      await cleanup();
    }
  });

  it("doctor with unknown category exits with error", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor-bad-category");
    try {
      const { stderr, exitCode } = await runCli(["doctor", "unknown"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Invalid category");
    } finally {
      await cleanup();
    }
  });
});
