import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd clean", () => {
  it("previews files to remove without deleting them", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["clean"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/--force|Cancelled/);
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".aidd"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("deletes all installed files and manifest when --force is used", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Cleaned all AIDD files");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("reports nothing to clean when not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to clean");
    } finally {
      await cleanup();
    }
  });

  it("lists tool names and file counts in dry-run preview output", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["clean"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toMatch(/\d+ files?/);
    } finally {
      await cleanup();
    }
  });

  it("removes all tool directories when multiple tools are installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Cleaned");

      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(false);
      expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("removes docs and manifest when only init was run", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Cleaned");
      expect(existsSync(join(projectDir, "aidd_docs"))).toBe(false);
      expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("shows 'Would remove' summary in non-interactive mode without --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("clean");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // runCli always runs non-TTY (child process without TTY)
      const { stdout, exitCode } = await runCli(["clean"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Would remove");
      expect(stdout).toContain("--force");
    } finally {
      await cleanup();
    }
  });
});
