import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLI_PATH,
  createTestEnv,
  execFileAsync,
  FRAMEWORK_PATH,
  FRAMEWORK_V2_PATH,
  initProject,
  runCli,
} from "./helpers.js";

async function runCliNoAuth(
  args: string[],
  cwd: string,
  fakeHome: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: fakeHome };
  delete env.AIDD_TOKEN;
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], { cwd, env });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

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
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["update", "--path", FRAMEWORK_PATH], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Already up to date");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — UpdateUseCase doesn't process framework plugins/ dir; needs PluginDistributionReader integration or post-1.E.7 rework
  it.skip("applies added and changed files when updating to a newer framework", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Updated \d+ files/);
      // new file from v2
      expect(
        existsSync(
          join(projectDir, ".claude", "plugins", "aidd-test", "commands", "04", "assert.md")
        )
      ).toBe(true);
      // changed file from v2
      const naming = await readFile(
        join(projectDir, ".claude", "plugins", "aidd-test", "rules", "01-standards", "naming.md"),
        "utf-8"
      );
      expect(naming).toContain("UPPER_SNAKE_CASE");
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — UpdateUseCase doesn't process framework plugins/ dir; needs PluginDistributionReader integration or post-1.E.7 rework
  it.skip("removes files that no longer exist in the newer framework", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // agent exists after v1 install
      expect(
        existsSync(
          join(projectDir, ".claude", "plugins", "aidd-test", "agents", "code-reviewer.md")
        )
      ).toBe(true);

      await runCli(["update", "--path", FRAMEWORK_V2_PATH], projectDir);

      // agent removed in v2
      expect(
        existsSync(
          join(projectDir, ".claude", "plugins", "aidd-test", "agents", "code-reviewer.md")
        )
      ).toBe(false);
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — UpdateUseCase doesn't process framework plugins/ dir; needs PluginDistributionReader integration or post-1.E.7 rework
  it.skip("creates a .backup when updating a user-modified file", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
      await writeFile(namingPath, "# my custom naming rules\n");

      const { stdout, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Updated \d+ files/);

      const rulesDir = join(projectDir, ".claude", "plugins", "aidd-test", "rules", "01-standards");
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

  // TODO: Plugin.frameworkPath gap — UpdateUseCase doesn't process framework plugins/ dir; needs PluginDistributionReader integration or post-1.E.7 rework
  it.skip("does not write files with --dry-run but shows what would change", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
      const contentBefore = await readFile(namingPath, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--dry-run"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("The following changes would be applied");

      // section header format: "\nclaude (v<version>):"
      expect(stdout).toMatch(/claude \(v[^)]+\):/);

      const contentAfter = await readFile(namingPath, "utf-8");
      expect(contentAfter).toBe(contentBefore);
      expect(
        existsSync(
          join(projectDir, ".claude", "plugins", "aidd-test", "commands", "04", "assert.md")
        )
      ).toBe(false);
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — UpdateUseCase doesn't process framework plugins/ dir; needs PluginDistributionReader integration or post-1.E.7 rework
  it.skip("overwrites conflicts without prompting with --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const namingPath = join(
        projectDir,
        ".claude",
        "plugins",
        "aidd-test",
        "rules",
        "01-standards",
        "naming.md"
      );
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

  it("rejects the legacy --docs flag", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      const { stderr, exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_PATH, "--docs"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/unknown option/i);
    } finally {
      await cleanup();
    }
  });

  // TODO: Plugin.frameworkPath gap — UpdateUseCase doesn't process framework plugins/ dir; needs PluginDistributionReader integration or post-1.E.7 rework
  it.skip("--tool scope updates only the specified tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const cursorNamingBefore = await readFile(
        join(projectDir, ".cursor", "plugins", "aidd-test", "rules", "01-standards", "naming.mdc"),
        "utf-8"
      );

      const { exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--tool", "claude"],
        projectDir
      );

      expect(exitCode).toBe(0);
      // claude should have been updated (new file from v2 added)
      expect(
        existsSync(
          join(projectDir, ".claude", "plugins", "aidd-test", "commands", "04", "assert.md")
        )
      ).toBe(true);
      // cursor naming file should be unchanged
      const cursorNamingAfter = await readFile(
        join(projectDir, ".cursor", "plugins", "aidd-test", "rules", "01-standards", "naming.mdc"),
        "utf-8"
      );
      expect(cursorNamingAfter).toBe(cursorNamingBefore);
    } finally {
      await cleanup();
    }
  });

  it("--release flag without --path triggers remote resolution and requires auth", async () => {
    const { projectDir, cleanup } = await createTestEnv("update-release");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const fakeHome = join(projectDir, "fake-home");
      await mkdir(fakeHome, { recursive: true });

      const { stderr, exitCode } = await runCliNoAuth(
        ["update", "--release", "v3.9.0"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/not authenticated|auth login/i);
    } finally {
      await cleanup();
    }
  });

  it("deletes merge files that become empty after key removal during update", async () => {
    const { projectDir, cleanup } = await createTestEnv("update-empty-merge");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ide", "vscode", "--path", FRAMEWORK_PATH], projectDir);

      // v2 removes the extensions.json recommendations key — file should be deleted, not left as {}
      const { exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, ".vscode", "extensions.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("updates codex (a tool with no rules capability) without crashing", async () => {
    const { projectDir, cleanup } = await createTestEnv("update-codex");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "codex", "--path", FRAMEWORK_PATH], projectDir);

      const { exitCode } = await runCli(
        ["update", "--path", FRAMEWORK_V2_PATH, "--force"],
        projectDir
      );

      expect(exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });
});
