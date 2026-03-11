import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, createTestEnv, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd uninstall", () => {
  it("removes a tool's files without touching other installed tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Uninstalled claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when uninstalling a tool that is not installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["uninstall", "cursor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("cursor is not installed");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when the project is not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      const { stderr, exitCode } = await runCli(["uninstall", "claude"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD installation found");
    } finally {
      await cleanup();
    }
  });

  it("removes multiple tools in one command", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "claude", "cursor"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Uninstalled");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(false);
    } finally {
      await cleanup();
    }
  }, 10000);

  it("shows an error message for unrecognized tool IDs", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      const { stderr, exitCode } = await runCli(["uninstall", "unknown-tool"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when no tool is specified and --all is not used", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["uninstall"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--all");
    } finally {
      await cleanup();
    }
  });

  it("uninstalls all tools at once with --all", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "--all"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("copilot");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(false);
      expect(existsSync(join(projectDir, ".github"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("manifest correctly reflects remaining tools after partial uninstall", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["uninstall", "claude"], projectDir);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
      expect(manifest.tools.claude).toBeUndefined();
      expect(manifest.tools.cursor).toBeDefined();
    } finally {
      await cleanup();
    }
  }, 10000);

  it("warns when --all is set with explicit tool IDs", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["uninstall", "--all", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("ignoring specified tools");
    } finally {
      await cleanup();
    }
  });
});
