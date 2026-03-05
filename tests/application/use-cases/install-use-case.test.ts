import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../../src/application/use-cases/install-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import { FileSystemAdapter } from "../../../src/infrastructure/adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { LoggerAdapter } from "../../../src/infrastructure/adapters/logger-adapter.js";
import { ManifestRepositoryAdapter } from "../../../src/infrastructure/adapters/manifest-repository-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");

describe("InstallUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-install-test-"));
    projectRoot = join(tempDir, "project");
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function buildDeps() {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    const loader = new FrameworkLoaderAdapter();
    const logger = new LoggerAdapter(false);
    return { hasher, fs, manifestRepo, loader, logger };
  }

  async function initFirst(deps: ReturnType<typeof buildDeps>) {
    const initUseCase = new InitUseCase(deps.fs, deps.manifestRepo, deps.loader, deps.hasher);
    await initUseCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });
  }

  it("installs claude tool and writes files to project", async () => {
    const deps = buildDeps();
    await initFirst(deps);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.length).toBe(1);
    expect(result[0].toolId).toBe("claude" as ToolId);
    expect(result[0].fileCount).toBeGreaterThan(0);
    expect(result[0].skipped).toBe(false);
  });

  it("records installed tool in manifest", async () => {
    const deps = buildDeps();
    await initFirst(deps);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "config.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeDefined();
  });

  it("skips already installed tool without --force", async () => {
    const deps = buildDeps();
    await initFirst(deps);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.length).toBe(1);
    expect(result[0].skipped).toBe(true);
    expect(result[0].fileCount).toBe(0);
  });

  it("reinstalls with --force even if already installed", async () => {
    const deps = buildDeps();
    await initFirst(deps);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(result[0].fileCount).toBeGreaterThan(0);
    expect(result[0].skipped).toBe(false);
  });

  it("installs multiple tools at once", async () => {
    const deps = buildDeps();
    await initFirst(deps);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    const result = await useCase.execute({
      toolIds: ["claude" as ToolId, "cursor" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.length).toBe(2);
    const manifestPath = join(projectRoot, ".aidd", "config.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeDefined();
    expect(data.tools.cursor).toBeDefined();
  });

  it("throws when no tool IDs provided", async () => {
    const deps = buildDeps();
    await initFirst(deps);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    await expect(
      useCase.execute({
        toolIds: [],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("At least one tool ID is required");
  });
});
