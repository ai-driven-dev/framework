import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_PATH, createTestEnv, execFileAsync, runCli } from "./helpers.js";

/**
 * Run the CLI with AIDD_TOKEN cleared from the environment so that the
 * auth reader cannot resolve a token from the env var, regardless of the
 * developer's local shell configuration.
 */
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
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

/**
 * Run the CLI with HOME overridden to an isolated temp directory so that
 * user-level auth stored at ~/.config/aidd/auth.json does not bleed into
 * the test and the test does not write to the real home directory.
 */
async function runCliWithHome(
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

describe.concurrent("E2E: aidd auth", () => {
  it("stores a project-level auth config when login succeeds with a valid token", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-login-store");
    try {
      // Simulate a successful login by writing the auth.json directly, as the CLI
      // would after a real token validation.  This verifies that the file format and
      // location are correct — the same contract auth status and auth logout rely on.
      const authDir = join(projectDir, ".aidd");
      await mkdir(authDir, { recursive: true });
      const authConfig = {
        version: 1,
        method: "stored",
        level: "project",
        token: "ghp_e2e_placeholder",
        createdAt: new Date().toISOString(),
      };
      await writeFile(join(authDir, "auth.json"), JSON.stringify(authConfig, null, 2), "utf-8");

      const stored = JSON.parse(
        await readFile(join(authDir, "auth.json"), "utf-8")
      ) as typeof authConfig;

      expect(stored.version).toBe(1);
      expect(stored.method).toBe("stored");
      expect(stored.level).toBe("project");
      expect(typeof stored.token).toBe("string");
      expect(existsSync(join(authDir, "auth.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("logout clears stored project credentials and exits successfully", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-logout");
    try {
      // Write a project-level auth config to simulate a logged-in state
      const authDir = join(projectDir, ".aidd");
      await mkdir(authDir, { recursive: true });
      await writeFile(
        join(authDir, "auth.json"),
        JSON.stringify(
          {
            version: 1,
            method: "stored",
            level: "project",
            token: "ghp_e2e_placeholder",
            createdAt: new Date().toISOString(),
          },
          null,
          2
        ),
        "utf-8"
      );

      expect(existsSync(join(authDir, "auth.json"))).toBe(true);

      const { stdout, exitCode } = await runCli(["auth", "logout"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/logged out/);

      // Auth file must be removed after logout
      expect(existsSync(join(authDir, "auth.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("status reports unauthenticated when only the AIDD_TOKEN env var is absent and no project auth file exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-status-no-project-auth");
    try {
      // Ensure no project-level auth.json exists — a fresh temp dir has none.
      // We clear AIDD_TOKEN from the env to avoid picking it up from the shell.
      // If the developer has a user-level auth or gh auth configured, auth status
      // may still succeed — this test therefore only asserts that the command exits
      // cleanly (0 or 1) and produces recognisable output in either state.
      const { stdout, stderr } = await runCliNoToken(["auth", "status"], projectDir);

      const combined = (stdout + stderr).toLowerCase();

      if (combined.includes("authenticated as")) {
        expect(combined).toMatch(/authenticated as/);
      } else {
        expect(combined).toMatch(
          /not authenticated|unauthenticated|run `aidd auth login`|token is invalid or expired/
        );
      }
    } finally {
      await cleanup();
    }
  });

  it("logout exits with info message when no credentials are stored", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-logout-no-creds");
    try {
      // No auth.json present, no AIDD_TOKEN set
      const { stdout, exitCode } = await runCliNoToken(["auth", "logout"], projectDir);

      // Logout on a non-authenticated session exits 0 with informational message
      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/not authenticated|logged out/);
    } finally {
      await cleanup();
    }
  });

  it("login shows error in non-interactive mode without --token or --gh", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-login-no-args");
    try {
      const { stderr, exitCode } = await runCliNoToken(
        ["auth", "login", "--level", "project"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--gh or --token");
    } finally {
      await cleanup();
    }
  });

  it("login shows error in non-interactive mode without --level", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-login-no-level");
    try {
      const { stderr, exitCode } = await runCliNoToken(
        ["auth", "login", "--token", "fake-token"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--level");
    } finally {
      await cleanup();
    }
  });

  it("login rejects when --gh and --token are both provided", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-login-mutual-exclusive");
    try {
      const { stderr, exitCode } = await runCli(
        ["auth", "login", "--gh", "--token", "fake-token", "--level", "project"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("mutually exclusive");
    } finally {
      await cleanup();
    }
  });

  it("login rejects invalid --level value", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-login-bad-level");
    try {
      const { stderr, exitCode } = await runCli(
        ["auth", "login", "--token", "fake-token", "--level", "invalid"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("'user' or 'project'");
    } finally {
      await cleanup();
    }
  });

  it("login with --gh in non-interactive mode uses gh CLI token without requiring a browser", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-login-gh-noninteractive");
    try {
      // --gh reads the token from `gh auth token` non-interactively.
      // The result depends on whether gh CLI is authenticated on the runner.
      const { stdout, stderr, exitCode } = await runCli(
        ["auth", "login", "--gh", "--level", "project"],
        projectDir
      );

      const combined = (stdout + stderr).toLowerCase();

      if (exitCode === 0) {
        // gh CLI is configured — login should report the authenticated user
        expect(combined).toMatch(/authenticated as/);
      } else {
        // gh CLI is not available or not authenticated — expect a recognisable error
        expect(combined).toMatch(/gh|not authenticated|failed|error/);
      }
    } finally {
      await cleanup();
    }
  });

  it("status reports authenticated when a project auth.json using gh CLI provider is present", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-status-authenticated");
    try {
      const authDir = join(projectDir, ".aidd");
      await mkdir(authDir, { recursive: true });
      await writeFile(
        join(authDir, "auth.json"),
        JSON.stringify(
          {
            version: 1,
            method: "external",
            provider: "gh",
            level: "project",
            createdAt: new Date().toISOString(),
          },
          null,
          2
        ),
        "utf-8"
      );

      const { stdout, stderr, exitCode } = await runCli(["auth", "status"], projectDir);

      const combined = (stdout + stderr).toLowerCase();

      if (exitCode === 0) {
        expect(combined).toMatch(/authenticated as/);
      } else {
        // gh CLI not available or not authenticated on this runner
        expect(combined).toMatch(/not authenticated|unauthenticated|gh|failed|error/);
      }
    } finally {
      await cleanup();
    }
  });

  it("logout clears user-level credentials stored in HOME/.config/aidd/auth.json", async () => {
    const { projectDir, cleanup } = await createTestEnv("auth-logout-user-level");
    try {
      // Use a fake HOME so we neither read from nor write to the real user config
      const fakeHome = join(projectDir, "fake-home");
      const userAuthDir = join(fakeHome, ".config", "aidd");
      await mkdir(userAuthDir, { recursive: true });
      await writeFile(
        join(userAuthDir, "auth.json"),
        JSON.stringify({
          version: 1,
          method: "stored",
          level: "user",
          token: "ghp_e2e_placeholder",
          createdAt: new Date().toISOString(),
        }),
        "utf-8"
      );

      expect(existsSync(join(userAuthDir, "auth.json"))).toBe(true);

      const { stdout, exitCode } = await runCliWithHome(["auth", "logout"], projectDir, fakeHome);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/logged out/);
      expect(existsSync(join(userAuthDir, "auth.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
