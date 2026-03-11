import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const CLI_PATH = resolve(process.cwd(), "dist/cli.js");
export const FRAMEWORK_PATH = resolve(process.cwd(), "tests/fixtures/framework");
export const FRAMEWORK_V2_PATH = resolve(process.cwd(), "tests/fixtures/framework-v2");

export async function createTestEnv(
  prefix: string
): Promise<{ tempDir: string; projectDir: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), `aidd-e2e-${prefix}-`));
  const projectDir = join(tempDir, "project");
  await mkdir(projectDir, { recursive: true });
  return {
    tempDir,
    projectDir,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}

export async function runCli(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], { cwd });
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
