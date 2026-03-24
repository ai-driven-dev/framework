import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, gitInit, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd install", () => {
  it("requires init first — aborts with clear error on uninitialized project", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "cursor", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "copilot", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stderr, exitCode } = await runCli(
        ["install", "unknown-tool", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["install", "claude", "--force", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "--all", "--path", FRAMEWORK_PATH],
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

  it("exits with error in non-interactive mode when no tool is specified and --all is not used", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      const { stderr, exitCode } = await runCli(["install", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("non-interactive mode");
    } finally {
      await cleanup();
    }
  });

  it("shows no drift in status after installing all tools at once", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "--all", "--path", FRAMEWORK_PATH], projectDir);
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "--all", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["install", "--all", "--force", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH, { docsDir: "my_docs" });
      expect(existsSync(join(projectDir, "my_docs"))).toBe(true);

      // install claude - should use my_docs/ not aidd_docs/ (reads docsDir from manifest)
      const { exitCode: installExit } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
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
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

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

  it("installs memory update script after tool install", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      expect(existsSync(join(projectDir, ".aidd", "scripts", "update_memory.js"))).toBe(true);
      expect(existsSync(join(projectDir, ".aidd", "hooks", "pre-commit"))).toBe(true);

      const hookContent = await readFile(join(projectDir, ".aidd", "hooks", "pre-commit"), "utf-8");
      expect(hookContent).toContain("node .aidd/scripts/update_memory.js");

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { scripts: unknown };
      expect(manifest.scripts).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("installs git pre-commit hook when .git directory is present", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await gitInit(projectDir);
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      expect(existsSync(join(projectDir, ".git", "hooks", "pre-commit"))).toBe(true);

      const hookContent = await readFile(join(projectDir, ".git", "hooks", "pre-commit"), "utf-8");
      expect(hookContent).toContain("sh .aidd/hooks/pre-commit");
    } finally {
      await cleanup();
    }
  });

  it("appends to existing pre-commit hook without replacing it", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await gitInit(projectDir);

      const gitHookPath = join(projectDir, ".git", "hooks", "pre-commit");
      await writeFile(gitHookPath, "#!/bin/sh\necho 'existing hook'\n");
      await chmod(gitHookPath, 0o755);

      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const hookContent = await readFile(gitHookPath, "utf-8");
      expect(hookContent).toContain("echo 'existing hook'");
      expect(hookContent).toContain("sh .aidd/hooks/pre-commit");
    } finally {
      await cleanup();
    }
  });

  it("does not append to pre-commit hook twice (idempotent)", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await gitInit(projectDir);
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--force", "--path", FRAMEWORK_PATH], projectDir);

      const hookContent = await readFile(join(projectDir, ".git", "hooks", "pre-commit"), "utf-8");
      const occurrences = hookContent.split("sh .aidd/hooks/pre-commit").length - 1;
      expect(occurrences).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("installs opencode tool with correct file layout", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stdout, exitCode } = await runCli(
        ["install", "opencode", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed opencode");
      expect(existsSync(join(projectDir, ".opencode"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("warns and ignores explicit tool IDs when --all is set", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(
        ["install", "--all", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stderr).toContain("ignoring specified tools");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in rules section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
      await mkdir(join(projectDir, ".claude", "rules", "01-standards"), { recursive: true });
      await writeFile(userFilePath, "user naming rule");

      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user naming rule");
      expect(stderr).toContain("naming.md");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in commands section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(projectDir, ".claude", "commands", "aidd", "04", "implement.md");
      await mkdir(join(projectDir, ".claude", "commands", "aidd", "04"), { recursive: true });
      await writeFile(userFilePath, "user implement command");

      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user implement command");
      expect(stderr).toContain("implement.md");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in agents section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(projectDir, ".claude", "agents", "code-reviewer.md");
      await mkdir(join(projectDir, ".claude", "agents"), { recursive: true });
      await writeFile(userFilePath, "user agent");

      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user agent");
      expect(stderr).toContain("code-reviewer.md");
    } finally {
      await cleanup();
    }
  });

  it("preserves pre-existing user file in skills section", async () => {
    const { projectDir, cleanup } = await createTestEnv("install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const userFilePath = join(projectDir, ".claude", "skills", "commit", "SKILL.md");
      await mkdir(join(projectDir, ".claude", "skills", "commit"), { recursive: true });
      await writeFile(userFilePath, "user skill");

      const { stderr, exitCode } = await runCli(
        ["install", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      const content = await readFile(userFilePath, "utf-8");
      expect(content).toBe("user skill");
      expect(stderr).toContain("SKILL.md");
    } finally {
      await cleanup();
    }
  });
});
