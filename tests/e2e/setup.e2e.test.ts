import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_PATH, createTestEnv, execFileAsync, FRAMEWORK_PATH, runCli } from "./helpers.js";

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

describe.concurrent("E2E: aidd setup", () => {
  it("shows usage with --help", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-help");
    try {
      const { stdout, exitCode } = await runCli(["setup", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("setup");
    } finally {
      await cleanup();
    }
  });

  it("needs-init state, non-interactive, no extra flags — succeeds with exit 0", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-init-noninteractive");
    try {
      const { exitCode } = await runCli(
        ["setup", "--path", FRAMEWORK_PATH, "--release", "test"],
        projectDir
      );

      expect(exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("needs-adopt state, non-interactive, missing --from — exits 1 with error", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-adopt-no-from");
    try {
      // Create an AIDD signal file so detectSetupState returns needs-adopt
      const commandDir = join(projectDir, ".claude", "commands");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "implement.md"),
        "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
      );

      const { stderr, exitCode } = await runCli(["setup", "--ai", "claude"], projectDir);

      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/from|adopt/);
    } finally {
      await cleanup();
    }
  });

  it("--ai claude --path local in non-TTY creates manifest and installs tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-ai-claude");
    try {
      const { stdout, exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("--all --path local installs all tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-all");
    try {
      const { stdout, exitCode } = await runCli(
        ["setup", "--all", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("--ai claude --ide vscode --path local installs both tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-ai-ide");
    try {
      const { stdout, exitCode } = await runCli(
        ["setup", "--ai", "claude", "--ide", "vscode", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude");
      expect(stdout).toContain("vscode");
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".vscode"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("--docs-dir custom_docs uses the custom docs directory name", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-docs-dir");
    try {
      const { stdout, exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH, "--docs-dir", "custom_docs"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("custom_docs");
      expect(existsSync(join(projectDir, "custom_docs"))).toBe(true);
      expect(existsSync(join(projectDir, "aidd_docs"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("already-initialized project with same tool runs update and exits 0", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-reinit");
    try {
      await runCli(["setup", "--ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/updated|up to date/i);
    } finally {
      await cleanup();
    }
  });

  it("--release flag without --path triggers remote resolution and requires auth", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-release");
    try {
      const fakeHome = join(projectDir, "fake-home");
      await mkdir(fakeHome, { recursive: true });

      const { stderr, exitCode } = await runCliNoAuth(
        ["setup", "--ai", "claude", "--release", "v3.9.0"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/not authenticated|auth login/i);
    } finally {
      await cleanup();
    }
  });

  it("--from with adopt signals creates adopted state", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-from-adopt");
    try {
      const commandDir = join(projectDir, ".claude", "commands", "aidd", "04");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "implement.md"),
        "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
      );

      const { stdout, exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH, "--from", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/adopted/);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
      expect(manifest.tools.claude).toBeDefined();
    } finally {
      await cleanup();
    }
  });
});
