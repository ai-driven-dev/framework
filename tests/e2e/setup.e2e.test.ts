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

  it("--mode local copies plugins/ and .claude-plugin/ to project root", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-mode-local");
    try {
      const { exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH, "--mode", "local"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
      expect(existsSync(join(projectDir, "plugins", "aidd-test"))).toBe(true);
      expect(existsSync(join(projectDir, ".claude-plugin", "marketplace.json"))).toBe(true);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { mode: string; plugins: unknown };
      expect(manifest.mode).toBe("local");
      expect(manifest.plugins).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("--mode remote does not copy plugins/ to project root", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-mode-remote");
    try {
      const { exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH, "--mode", "remote"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, "plugins"))).toBe(false);
      expect(existsSync(join(projectDir, ".claude-plugin"))).toBe(false);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { mode: string };
      expect(manifest.mode).toBe("remote");
    } finally {
      await cleanup();
    }
  });

  it("--switch-mode --mode remote on local-mode project switches mode in manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-switch-mode");
    try {
      await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH, "--mode", "local"],
        projectDir
      );

      const { stdout, exitCode } = await runCli(
        ["setup", "--switch-mode", "--mode", "remote"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/switch|remote/);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { mode: string };
      expect(manifest.mode).toBe("remote");
    } finally {
      await cleanup();
    }
  });

  it("--mode invalid exits 1 with error message", async () => {
    const { projectDir, cleanup } = await createTestEnv("setup-mode-invalid");
    try {
      const { stderr, exitCode } = await runCli(
        ["setup", "--ai", "claude", "--path", FRAMEWORK_PATH, "--mode", "invalid"],
        projectDir
      );

      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/invalid|mode/i);
    } finally {
      await cleanup();
    }
  });
});
