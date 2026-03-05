import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { FileSystemAdapter } from "../../../src/infrastructure/adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../src/infrastructure/adapters/manifest-repository-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");

describe("InitUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-init-test-"));
    projectRoot = join(tempDir, "project");
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function buildUseCase() {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    const loader = new FrameworkLoaderAdapter();
    return new InitUseCase(fs, manifestRepo, loader, hasher);
  }

  it("creates the docs directory from framework templates", async () => {
    const useCase = buildUseCase();
    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.docsDir).toBe("aidd_docs");
  });

  it("creates the manifest at .aidd/config.json", async () => {
    const useCase = buildUseCase();
    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "config.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { version: string; docs: unknown };
    expect(data.version).toBe("1");
    expect(data.docs).not.toBeNull();
  });

  it("always stores docsDir in manifest, even when default", async () => {
    const useCase = buildUseCase();
    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "config.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    expect(data.docsDir).toBe("aidd_docs");
  });

  it("stores custom docsDir in manifest", async () => {
    const useCase = buildUseCase();
    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "my_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "config.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    expect(data.docsDir).toBe("my_docs");
  });

  it("proceeds when .aidd/ exists but no config.json", async () => {
    await mkdir(join(projectRoot, ".aidd"), { recursive: true });

    const useCase = buildUseCase();
    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.fileCount).toBeGreaterThan(0);
    expect(existsSync(join(projectRoot, ".aidd", "config.json"))).toBe(true);
  });

  it("throws when docs directory already exists", async () => {
    const docsPath = join(projectRoot, "aidd_docs");
    await mkdir(docsPath, { recursive: true });

    const useCase = buildUseCase();
    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd_docs");
  });

  it("creates files in custom docs dir", async () => {
    const useCase = buildUseCase();
    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "my_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "config.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { docs: { files: { relativePath: string }[] } };
    const paths = data.docs.files.map((f) => f.relativePath);
    expect(paths.some((p) => p.startsWith("my_docs/"))).toBe(true);
  });
});
