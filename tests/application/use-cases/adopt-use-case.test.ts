import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdoptUseCase } from "../../../src/application/use-cases/adopt-use-case.js";
import {
  FIXTURE_DIR,
  KeepPrompter,
  OverwritePrompter,
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
} from "./helpers.js";

describe("AdoptUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function buildUseCase(prompter = new OverwritePrompter()) {
    const deps = buildDeps(projectRoot);
    return new AdoptUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      prompter
    );
  }

  it("aborts if manifest already exists", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("Already initialized");
  });

  it("aborts if no AIDD directories found", async () => {
    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("No AIDD directories found");
  });

  it("writes all new files when nothing on disk", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    const result = await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].toolId).toBe("claude");
    expect(result.totalWritten).toBeGreaterThan(0);
    expect(result.totalKept).toBe(0);
    expect(result.totalBackedUp).toBe(0);
    expect(existsSync(join(projectRoot, ".aidd", "manifest.json"))).toBe(true);
  });

  it("keeps all conflicting files when prompter returns keep", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    // First adopt to populate disk with files
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    // Remove manifest to simulate manual installation
    await rm(join(projectRoot, ".aidd"), { recursive: true, force: true });

    const result = await buildUseCase(new KeepPrompter()).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.totalKept).toBeGreaterThan(0);
    expect(result.totalWritten).toBe(0);
    expect(result.totalBackedUp).toBe(0);
  });

  it("backs up and overwrites conflicting files when force=true", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    // Seed a file in .claude/
    const namingPath = join(projectRoot, ".claude", "rules", "01-standards", "naming.md");
    await mkdir(join(projectRoot, ".claude", "rules", "01-standards"), { recursive: true });
    await writeFile(namingPath, "user modified content");

    const result = await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(result.totalBackedUp).toBeGreaterThan(0);
    expect(result.totalWritten).toBeGreaterThan(0);
    expect(existsSync(`${namingPath}.backup`)).toBe(true);
  });

  it("mixed: new files written, conflicts kept or overwritten", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    // Seed one file (creates a conflict)
    const namingPath = join(projectRoot, ".claude", "rules", "01-standards", "naming.md");
    await mkdir(join(projectRoot, ".claude", "rules", "01-standards"), { recursive: true });
    await writeFile(namingPath, "user content");

    const result = await buildUseCase(new KeepPrompter()).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    // Some files should be written (new), one kept (conflict)
    expect(result.totalWritten).toBeGreaterThan(0);
    expect(result.totalKept).toBeGreaterThan(0);
  });

  it("detects orphan files on disk and warns but does not delete them", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    // First adopt to populate disk
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    // Add an orphan file
    const orphanPath = join(projectRoot, ".claude", "rules", "user-custom.md");
    await writeFile(orphanPath, "my custom rule");

    // Remove manifest to simulate manual installation
    await rm(join(projectRoot, ".aidd"), { recursive: true, force: true });

    const result = await buildUseCase(new KeepPrompter()).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.orphans.length).toBeGreaterThan(0);
    expect(result.orphans.some((o) => o.includes("user-custom.md"))).toBe(true);
    // Orphan file should still exist (not deleted)
    expect(existsSync(orphanPath)).toBe(true);
  });

  it("creates manifest after adoption", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeDefined();
  });

  it("detects cursor tool from .cursor/ directory", async () => {
    await mkdir(join(projectRoot, ".cursor"), { recursive: true });

    const result = await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.tools.some((t) => t.toolId === "cursor")).toBe(true);
  });

  it("detects copilot tool from .github/copilot-instructions.md", async () => {
    await mkdir(join(projectRoot, ".github"), { recursive: true });
    await writeFile(
      join(projectRoot, ".github", "copilot-instructions.md"),
      "# Copilot Instructions"
    );

    const result = await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.tools.some((t) => t.toolId === "copilot")).toBe(true);
  });
});
