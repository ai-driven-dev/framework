import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd uninstall", () => {
  it("removes a tool's files without touching other installed tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "ai", "claude"], projectDir);

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["uninstall", "ai", "cursor"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("cursor is not installed");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when the project is not initialized", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      const { stderr, exitCode } = await runCli(["uninstall", "ai", "claude"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
      expect(stderr).toContain("aidd setup");
    } finally {
      await cleanup();
    }
  });

  it("removes multiple tools in one command", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["uninstall", "ai", "claude", "cursor"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Uninstalled");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("shows an error message for unrecognized tool IDs", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      const { stderr, exitCode } = await runCli(["uninstall", "ai", "unknown-tool"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("exits with error in non-interactive mode when no tool is specified and --all is not used", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["uninstall"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("non-interactive mode");
    } finally {
      await cleanup();
    }
  });

  it("uninstalls all tools at once with --all", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "--all", "--path", FRAMEWORK_PATH], projectDir);

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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["uninstall", "ai", "claude"], projectDir);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
      expect(manifest.tools.claude).toBeUndefined();
      expect(manifest.tools.cursor).toBeDefined();
    } finally {
      await cleanup();
    }
  });

  it("warns when --all is set with explicit tool IDs", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "--all", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["uninstall", "--all", "ai", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("ignoring specified tools");
    } finally {
      await cleanup();
    }
  });

  it("reports success when --all is used but no tools are installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stdout, exitCode } = await runCli(["uninstall", "--all"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("No tools installed");
    } finally {
      await cleanup();
    }
  });

  it("--mcp filter removes only that MCP server entry from claude", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall-mcp");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["uninstall", "ai", "claude", "--mcp", "playwright"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Uninstalled claude");

      // playwright entry must be gone; github entry (if present) must survive
      const mcpPath = join(projectDir, ".mcp.json");
      if (existsSync(mcpPath)) {
        const mcp = JSON.parse(await readFile(mcpPath, "utf-8")) as {
          mcpServers: Record<string, unknown>;
        };
        expect(mcp.mcpServers).not.toHaveProperty("playwright");
      }
    } finally {
      await cleanup();
    }
  });

  it("removes all codex files on uninstall", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "codex", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "ai", "codex"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Uninstalled codex");
      expect(existsSync(join(projectDir, ".codex"))).toBe(false);
      expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);
      expect(existsSync(join(projectDir, ".agents", "skills", "aidd-commit", "SKILL.md"))).toBe(
        false
      );
    } finally {
      await cleanup();
    }
  });

  it("removes vscode from the manifest on uninstall (IDE settings files preserve user content)", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ide", "vscode", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "ide", "vscode"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Uninstalled vscode");

      // IDE settings files are NOT deleted (user-prime merge strategy preserves user content)
      // but vscode must be removed from the manifest
      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
      expect(manifest.tools.vscode).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("uninstall ai --all with claude and vscode installed removes only AI tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("uninstall-ai-category");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ide", "vscode", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["uninstall", "ai", "--all"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
      expect(existsSync(join(projectDir, ".vscode"))).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
