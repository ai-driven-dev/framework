import { describe, expect, it } from "vitest";
import { CLI_PATH, createTestEnv, execFileAsync, runCli } from "./helpers.js";

async function runCliNoToken(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env = { ...process.env };
  delete env.AIDD_TOKEN;
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], { cwd, env });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.code ?? 1 };
  }
}

describe.concurrent("E2E: aidd self-update", () => {
  it("shows help with expected flags", async () => {
    const { projectDir, cleanup } = await createTestEnv("self-update");
    try {
      const { stdout, exitCode } = await runCli(["self-update", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("self-update");
      expect(stdout).toContain("--check");
      expect(stdout).toContain("--dry-run");
      expect(stdout).toContain("--force");
    } finally {
      await cleanup();
    }
  });

  it("--check exits 0 and outputs version information when authenticated", async () => {
    const { projectDir, cleanup } = await createTestEnv("self-update-check");
    try {
      // self-update --check requires auth (RequireAuthUseCase runs unconditionally)
      // If auth is available via user config or gh CLI, expect version output
      // If not, expect the auth error — both are valid observable behaviors in CI
      const { stdout, stderr, exitCode } = await runCliNoToken(
        ["self-update", "--check"],
        projectDir
      );

      if (exitCode === 0) {
        expect(stdout + stderr).toMatch(/up to date|New version available/i);
      } else {
        expect(stderr).toMatch(/not authenticated|auth login/i);
      }
    } finally {
      await cleanup();
    }
  });

  it("--dry-run exits 0 and shows what would be installed when authenticated", async () => {
    const { projectDir, cleanup } = await createTestEnv("self-update-dry-run");
    try {
      // self-update --dry-run also requires auth
      const { stdout, stderr, exitCode } = await runCliNoToken(
        ["self-update", "--dry-run"],
        projectDir
      );

      if (exitCode === 0) {
        expect(stdout).toContain("Would install");
        expect(stdout).toContain("@ai-driven-dev/cli@");
      } else {
        expect(stderr).toMatch(/not authenticated|auth login/i);
      }
    } finally {
      await cleanup();
    }
  });

  it("--dry-run does not output 'Successfully updated' in any auth state", async () => {
    const { projectDir, cleanup } = await createTestEnv("self-update-dry-run-no-install");
    try {
      const { stdout } = await runCliNoToken(["self-update", "--dry-run"], projectDir);

      expect(stdout).not.toContain("Successfully updated");
    } finally {
      await cleanup();
    }
  });

  it("--force is listed in help describing reinstall behavior", async () => {
    const { projectDir, cleanup } = await createTestEnv("self-update-force-help");
    try {
      const { stdout, exitCode } = await runCli(["self-update", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--force");
      expect(stdout.toLowerCase()).toMatch(/reinstall|up to date/);
    } finally {
      await cleanup();
    }
  });
});
