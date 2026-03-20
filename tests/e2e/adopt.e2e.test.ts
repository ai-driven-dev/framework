import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd adopt", () => {
  it("shows usage with --help", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      const { stdout, exitCode } = await runCli(["adopt", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--tools");
      expect(stdout).toContain("--docs-dir");
    } finally {
      await cleanup();
    }
  });

  it("fails when --from is not provided", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      const { exitCode, stderr } = await runCli(["adopt", "--tools", "claude"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--from <version|path> is required for adopt");
      expect(stderr).toContain("Check available tags for:");
    } finally {
      await cleanup();
    }
  });

  it("fails when --tools is missing", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      const { exitCode, stderr } = await runCli(["adopt", "--from", "3.3.3"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--tools");
    } finally {
      await cleanup();
    }
  });

  it("fails with unknown tool name", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      const { exitCode, stderr } = await runCli(
        ["adopt", "--from", FRAMEWORK_PATH, "--tools", "unknown-tool"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("fails when specified tool directory does not exist", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      const { exitCode, stderr } = await runCli(
        ["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain(".claude/");
    } finally {
      await cleanup();
    }
  });

  it("fails with 'Already initialized' when manifest already exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { exitCode, stderr } = await runCli(
        ["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Already initialized");
    } finally {
      await cleanup();
    }
  });

  it("creates manifest from manually installed .claude/ files", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

      const { stdout, exitCode } = await runCli(
        ["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Adopted");
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("status shows no drift after adopt (manifest hash matches disk)", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

      await runCli(["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude"], projectDir);

      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("in sync");
    } finally {
      await cleanup();
    }
  });

  it("adopts multiple tools (claude + cursor) when specified", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

      const { stdout, exitCode } = await runCli(
        ["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude,cursor"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("2 tool(s)");

      const manifest = JSON.parse(
        await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8")
      ) as { tools: Record<string, unknown> };
      expect(manifest.tools.claude).toBeDefined();
      expect(manifest.tools.cursor).toBeDefined();
    } finally {
      await cleanup();
    }
  });

  it("adopts all three tools (claude + cursor + copilot) when specified", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "copilot", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

      const { stdout, exitCode } = await runCli(
        ["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude,cursor,copilot"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("3 tool(s)");

      const manifest = JSON.parse(
        await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8")
      ) as { tools: Record<string, unknown> };
      expect(manifest.tools.claude).toBeDefined();
      expect(manifest.tools.cursor).toBeDefined();
      expect(manifest.tools.copilot).toBeDefined();
    } finally {
      await cleanup();
    }
  });

  it("deletes legacy config.json during adoption", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      await rm(join(projectDir, ".aidd", "manifest.json"));
      await writeFile(join(projectDir, ".aidd", "config.json"), "{}");

      await runCli(["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude"], projectDir);

      expect(existsSync(join(projectDir, ".aidd", "config.json"))).toBe(false);
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("does not register user files not in the framework distribution", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
      // Add a user file outside the framework distribution
      await writeFile(join(projectDir, ".claude", "rules", "my-custom.md"), "# Custom rule");
      await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

      await runCli(["adopt", "--from", FRAMEWORK_PATH, "--tools", "claude"], projectDir);

      const manifest = JSON.parse(
        await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8")
      ) as { tools: Record<string, { files: Array<{ relativePath: string }> }> };
      const registeredPaths = manifest.tools.claude.files.map((f) => f.relativePath);
      expect(registeredPaths).not.toContain(".claude/rules/my-custom.md");
    } finally {
      await cleanup();
    }
  });

  it("custom --repo propagates to AdoptRequiresVersionError", async () => {
    const { projectDir, cleanup } = await createTestEnv("adopt");
    try {
      const { exitCode, stderr } = await runCli(
        ["--repo", "myorg/my-framework", "adopt", "--tools", "claude"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Check available tags for: myorg/my-framework");
    } finally {
      await cleanup();
    }
  });
});
