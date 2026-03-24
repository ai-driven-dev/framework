import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { CLIOutput } from "../../src/application/output.js";
import { AdoptUseCase } from "../../src/application/use-cases/adopt-use-case.js";
import { InitUseCase } from "../../src/application/use-cases/init-use-case.js";
import { resolveFramework } from "../../src/application/use-cases/resolve-framework-use-case.js";
import { Manifest } from "../../src/domain/models/manifest.js";
import type { ToolId } from "../../src/domain/models/tool-config.js";
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

export async function initProject(
  projectDir: string,
  frameworkPath: string,
  options?: { docsDir?: string; repo?: string; force?: boolean }
): Promise<void> {
  const output = new CLIOutput(false);
  const deps = await createDeps(projectDir, { verbose: false }, output);
  const { path: resolvedPath, version } = await resolveFramework(deps.resolver, deps.logger, {
    path: frameworkPath,
  });
  await new InitUseCase(deps.fs, deps.manifestRepo, deps.loader, deps.hasher, deps.logger).execute({
    frameworkPath: resolvedPath,
    version,
    projectRoot: projectDir,
    interactive: false,
    docsDir: options?.docsDir,
    explicitDocsDir: options?.docsDir,
    repo: options?.repo,
    force: options?.force,
  });
}

export async function adoptProject(
  projectDir: string,
  frameworkPath: string,
  toolIds: ToolId[]
): Promise<void> {
  const output = new CLIOutput(false);
  const deps = await createDeps(projectDir, { verbose: false }, output);
  const { path: resolvedPath, version } = await resolveFramework(deps.resolver, deps.logger, {
    path: frameworkPath,
  });
  await new AdoptUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger,
    deps.platform
  ).execute({
    toolIds,
    frameworkPath: resolvedPath,
    docsDir: Manifest.DEFAULT_DOCS_DIR,
    projectRoot: projectDir,
    version,
  });
}
