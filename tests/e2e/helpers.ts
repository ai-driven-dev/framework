import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { CLIOutput } from "../../src/application/output.js";
import { InitUseCase } from "../../src/application/use-cases/init-use-case.js";
import { createDeps } from "../../src/infrastructure/deps.js";

export const execFileAsync = promisify(execFile);

const GIT_ENV_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
];

export async function gitInit(cwd: string): Promise<void> {
  const env = { ...process.env };
  for (const key of GIT_ENV_VARS) delete env[key];
  await execFileAsync("git", ["init"], { cwd, env });
}

export const CLI_PATH = resolve(process.cwd(), "dist/cli.js");
export const FRAMEWORK_PATH = resolve(process.cwd(), "tests/fixtures/framework");
export const FRAMEWORK_V2_PATH = resolve(process.cwd(), "tests/fixtures/framework-v2");

export async function createTestEnv(prefix: string): Promise<{
  tempDir: string;
  projectDir: string;
  fakeHome: string;
  cleanup: () => Promise<void>;
}> {
  const tempDir = await mkdtemp(join(tmpdir(), `aidd-e2e-${prefix}-`));
  const projectDir = join(tempDir, "project");
  const fakeHome = join(tempDir, "home");
  await mkdir(projectDir, { recursive: true });
  await mkdir(fakeHome, { recursive: true });
  return {
    tempDir,
    projectDir,
    fakeHome,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}

function sandboxedEnv(fakeHome: string, extra?: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...extra,
    HOME: fakeHome,
    XDG_CONFIG_HOME: join(fakeHome, ".config"),
  };
}

export async function runCli(
  args: string[],
  cwd: string,
  fakeHome: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env = sandboxedEnv(fakeHome);
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

/** Skips marketplace refresh (network call) for fast/flake-prone tests. */
export async function runCliFast(
  args: string[],
  cwd: string,
  fakeHome: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env = sandboxedEnv(fakeHome, { AIDD_SKIP_MARKETPLACE_REFRESH: "1" });
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
 * Initializes a project with a manifest. Used to set up e2e test fixtures.
 * The frameworkPath parameter is kept for API compatibility but no longer used
 * (init no longer copies framework files).
 */
export async function initProject(projectDir: string, _frameworkPath: string): Promise<void> {
  const output = new CLIOutput(false);
  const deps = await createDeps(projectDir, { verbose: false }, output);
  await new InitUseCase(deps.fs, deps.manifestRepo).execute({
    projectRoot: projectDir,
  });
}
