import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "../../../src/domain/tools/claude.js";
import "../../../src/domain/tools/copilot.js";
import "../../../src/domain/tools/cursor.js";
import "../../../src/domain/tools/opencode.js";
import { CLIOutput } from "../../../src/application/output.js";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../../src/application/use-cases/install-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import type { Git } from "../../../src/domain/ports/git.js";
import type { Platform } from "../../../src/domain/ports/platform.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import { FileSystemAdapter } from "../../../src/infrastructure/adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/prompter-adapter.js";

export const linuxPlatform: Platform = { current: () => "linux" };
export const win32Platform: Platform = { current: () => "win32" };
export const noGit: Git = { installPreCommitDelegate: async () => {} };

export { SilentPrompterAdapter as OverwritePrompter };

export class KeepPrompter implements Prompter {
  async resolveConflict(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return "keep";
  }
}

export class RecordingPrompter implements Prompter {
  readonly calls: Array<{ relativePath: string; reason: "deleted" | "modified" }> = [];
  private readonly response: "keep" | "overwrite";

  constructor(response: "keep" | "overwrite" = "overwrite") {
    this.response = response;
  }

  async resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    this.calls.push({ relativePath, reason });
    return this.response;
  }
}

export const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");
export const FIXTURE_DIR_V2 = join(process.cwd(), "tests/fixtures/framework-v2");

export function buildDeps(projectRoot: string) {
  const hasher = new HasherAdapter();
  const fs = new FileSystemAdapter(hasher);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const loader = new FrameworkLoaderAdapter();
  const logger = new CLIOutput(false);
  return { hasher, fs, manifestRepo, loader, logger };
}

export async function createTempProject(): Promise<{ tempDir: string; projectRoot: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), "aidd-test-"));
  const projectRoot = join(tempDir, "project");
  await mkdir(projectRoot, { recursive: true });
  return { tempDir, projectRoot };
}

export async function cleanupTempProject(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}

export async function initProject(
  deps: ReturnType<typeof buildDeps>,
  projectRoot: string
): Promise<void> {
  const initUseCase = new InitUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger
  );
  await initUseCase.execute({
    frameworkPath: FIXTURE_DIR,
    version: "test",
    docsDir: "aidd_docs",
    projectRoot,
  });
}

export async function installTool(
  deps: ReturnType<typeof buildDeps>,
  projectRoot: string,
  toolId: ToolId
) {
  const installUseCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger,
    noGit,
    linuxPlatform
  );
  const results = await installUseCase.execute({
    toolIds: [toolId],
    frameworkPath: FIXTURE_DIR,
    version: "test",
    docsDir: "aidd_docs",
    projectRoot,
  });
  return results[0];
}

export async function initAndInstall(
  deps: ReturnType<typeof buildDeps>,
  projectRoot: string,
  toolId: ToolId
) {
  await initProject(deps, projectRoot);
  return installTool(deps, projectRoot, toolId);
}
