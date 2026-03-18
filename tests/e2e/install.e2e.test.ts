import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd install", () => {
  it("requires init first — aborts with clear error on uninitialized project", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("installs claude tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(
        ["install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("installs cursor tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(
        ["install", "cursor", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed cursor");
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("installs copilot tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(
        ["install", "copilot", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed copilot");
      expect(existsSync(join(projectDir, ".github"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("shows an error message for unrecognized tool IDs", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stderr, exitCode } = await runCli(
        ["install", "unknown-tool", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown tool");
    } finally {
      await cleanup();
    }
  });

  it("skips already installed tool without --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stderr).toContain("already installed");
    } finally {
      await cleanup();
    }
  });

  it("reinstalls an existing tool when --force is used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["install", "claude", "--force", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
    } finally {
      await cleanup();
    }
  });

  it("installs all tools at once with --all", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(
        ["install", "--all", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("copilot");
      expect(stdout).toContain("opencode");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
      expect(existsSync(join(projectDir, ".github"))).toBe(true);
      expect(existsSync(join(projectDir, ".opencode"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("shows an error message when no tool is specified and --all is not used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      const { stderr, exitCode } = await runCli(
        ["install", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--all");
    } finally {
      await cleanup();
    }
  });

  it("shows no drift in status after installing all tools at once", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(["status"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("modified");
      expect(stdout).not.toContain("deleted");
    } finally {
      await cleanup();
    }
  });

  it("reinstalls all tools when --all --force is used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["install", "--all", "--force", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("copilot");
      expect(stdout).toContain("opencode");
    } finally {
      await cleanup();
    }
  });

  it("uses custom docs-dir from manifest when installing", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      // init with custom docs dir
      const { exitCode: initExit } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH, "--docs-dir", "my_docs"],
        projectDir
      );
      expect(initExit).toBe(0);
      expect(existsSync(join(projectDir, "my_docs"))).toBe(true);

      // install claude - should use my_docs/ not aidd_docs/ (reads docsDir from manifest)
      const { exitCode: installExit } = await runCli(
        ["install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );
      expect(installExit).toBe(0);

      // my_docs directory must still exist (was not replaced by aidd_docs)
      expect(existsSync(join(projectDir, "my_docs"))).toBe(true);
      // aidd_docs must not exist (install did not re-create with default name)
      expect(existsSync(join(projectDir, "aidd_docs"))).toBe(false);

      // manifest records my_docs as the docsDir
      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { docsDir: string };
      expect(manifest.docsDir).toBe("my_docs");
    } finally {
      await cleanup();
    }
  });

  it("generates files with all path placeholders resolved", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as {
        tools: { claude: { files: { relativePath: string }[] } };
      };

      for (const file of manifest.tools.claude.files) {
        const content = await readFile(join(projectDir, file.relativePath), "utf-8");
        expect(content).not.toContain("{{TOOLS}}/");
        expect(content).not.toContain("{{DOCS}}/");
      }
    } finally {
      await cleanup();
    }
  });
});
