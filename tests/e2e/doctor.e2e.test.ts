import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, createTestEnv, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd doctor", () => {
  it("reports a healthy installation after a fresh install", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installation is healthy");
    } finally {
      await cleanup();
    }
  }, 5000);

  it("shows an error message when the manifest JSON is corrupted", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await writeFile(join(projectDir, ".aidd", "manifest.json"), "{ not valid json", "utf-8");

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("corrupted");
    } finally {
      await cleanup();
    }
  }, 5000);

  it("shows an error message when the project is not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD installation found");
    } finally {
      await cleanup();
    }
  }, 5000);

  it("reports a warning for a broken @path reference in a tracked file", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      await writeFile(
        join(projectDir, ".claude", "agents", "code-reviewer.md"),
        "See @.claude/agents/nonexistent-agent.md for details",
        "utf-8"
      );

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("nonexistent-agent.md");
    } finally {
      await cleanup();
    }
  }, 5000);

  it("reports an error when the docs directory is missing from disk", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, "aidd_docs"), { recursive: true, force: true });

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("does not exist on disk");
    } finally {
      await cleanup();
    }
  }, 10000);

  it("reports orphaned directories as a warning", async () => {
    const { projectDir, cleanup } = await createTestEnv("doctor");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      await mkdir(join(projectDir, ".cursor"), { recursive: true });

      const { stderr, exitCode } = await runCli(["doctor"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Orphaned");
    } finally {
      await cleanup();
    }
  }, 10000);
});
