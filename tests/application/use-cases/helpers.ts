import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { CLIOutput } from "../../../src/application/output.js";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../../src/application/use-cases/install/install-use-case.js";
import type { Platform } from "../../../src/domain/ports/platform.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import type { VersionControl } from "../../../src/domain/ports/version-control.js";
import type { ToolId } from "../../../src/domain/tools/registry.js";
import { FileSystemAdapter } from "../../../src/infrastructure/adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/prompter-adapter.js";

export const linuxPlatform: Platform = { current: () => "linux" };
export const win32Platform: Platform = { current: () => "win32" };
export const noGit: VersionControl = { installPreCommitDelegate: async () => {} };

export { SilentPrompterAdapter as OverwritePrompter };

export class KeepPrompter implements Prompter {
  async resolveConflict(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return "keep";
  }

  async confirm(_message: string): Promise<boolean> {
    return true;
  }

  async input(_message: string, defaultValue?: string): Promise<string> {
    return defaultValue ?? "";
  }

  async select<T>(
    _message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean }>
  ): Promise<T> {
    const first = choices.find((c) => !c.disabled);
    if (first === undefined) {
      throw new Error("No enabled choices available");
    }
    return first.value;
  }

  async checkbox<T>(
    _message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]> {
    return choices.filter((c) => c.checked === true && !c.disabled).map((c) => c.value);
  }
}

abstract class QueuedSelectPrompter implements Prompter {
  private readonly selectQueue: string[];
  private selectIdx = 0;

  constructor(selectQueue: string[]) {
    this.selectQueue = selectQueue;
  }

  abstract resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite">;

  async confirm(_message: string): Promise<boolean> {
    return true;
  }

  async input(_message: string, defaultValue?: string): Promise<string> {
    return defaultValue ?? "";
  }

  async select<T>(
    _message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean }>
  ): Promise<T> {
    const response =
      this.selectQueue[this.selectIdx] ?? this.selectQueue[this.selectQueue.length - 1];
    this.selectIdx++;
    const match = choices.find((c) => !c.disabled && String(c.value) === response);
    if (match === undefined)
      throw new Error(`${this.constructor.name}: no match for "${response}" in choices`);
    return match.value;
  }

  async checkbox<T>(
    _message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]> {
    return choices.filter((c) => c.checked === true && !c.disabled).map((c) => c.value);
  }
}

export class SkipPrompter extends QueuedSelectPrompter {
  constructor() {
    super(["global", "skip all"]);
  }

  async resolveConflict(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return "keep";
  }
}

export class BackupPrompter extends QueuedSelectPrompter {
  constructor() {
    super(["global", "backup all"]);
  }

  async resolveConflict(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return "overwrite";
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

  async confirm(_message: string): Promise<boolean> {
    return true;
  }

  async input(_message: string, defaultValue?: string): Promise<string> {
    return defaultValue ?? "";
  }

  async select<T>(
    _message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean }>
  ): Promise<T> {
    const first = choices.find((c) => !c.disabled);
    if (first === undefined) {
      throw new Error("No enabled choices available");
    }
    return first.value;
  }

  async checkbox<T>(
    _message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]> {
    return choices.filter((c) => c.checked === true && !c.disabled).map((c) => c.value);
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
    deps.logger,
    new SilentPrompterAdapter()
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
    linuxPlatform,
    new SilentPrompterAdapter()
  );
  const results = await installUseCase.execute({
    toolIds: [toolId],
    frameworkPath: FIXTURE_DIR,
    version: "test",
    docsDir: "aidd_docs",
    projectRoot,
    mcpFilter: ["playwright", "github"],
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
