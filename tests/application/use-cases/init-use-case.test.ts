import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import {
  FIXTURE_DIR,
  buildDeps,
  cleanupTempProject,
  createTempProject,
  installTool,
} from "./helpers.js";

describe("InitUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function buildUseCase() {
    const { fs, manifestRepo, loader, hasher, logger } = buildDeps(projectRoot);
    return new InitUseCase(fs, manifestRepo, loader, hasher, logger);
  }

  it("creates the docs directory from framework templates", async () => {
    const result = await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.docsDir).toBe("aidd_docs");
  });

  it("tracks installed files for future drift detection", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    const data = JSON.parse(raw) as { version: number; docs: unknown };
    expect(data.version).toBe(1);
    expect(data.docs).not.toBeNull();
  });

  it("remembers custom docs dir name for subsequent commands", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "my_docs",
      projectRoot,
    });

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    expect(data.docsDir).toBe("my_docs");
  });

  it("aborts with adopt guidance when .aidd/ exists but no manifest.json", async () => {
    await mkdir(join(projectRoot, ".aidd"), { recursive: true });

    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd adopt");
  });

  it("aborts with adopt guidance when docs directory already exists", async () => {
    await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });

    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd adopt");
  });

  it("aborts with adopt guidance when .claude/ exists", async () => {
    await mkdir(join(projectRoot, ".claude"), { recursive: true });

    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("AIDD files detected");
  });

  describe("--force", () => {
    it("re-copies templates when docs dir exists", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      const result = await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });
      expect(result.fileCount).toBeGreaterThan(0);
    });

    it("does not overwrite unmodified files", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      const warnings: string[] = [];
      const { fs, manifestRepo, loader, hasher } = buildDeps(projectRoot);
      const logger = { debug: () => {}, info: () => {}, warn: (m: string) => warnings.push(m) };
      const useCase = new InitUseCase(fs, manifestRepo, loader, hasher, logger);
      await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });
      expect(warnings).toHaveLength(0);
    });

    it("overwrites and warns for modified files", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      const manifestBefore = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const firstFile = (
        JSON.parse(manifestBefore) as { docs: { files: { relativePath: string }[] } }
      ).docs.files[0];
      await writeFile(join(projectRoot, firstFile.relativePath), "modified content", "utf-8");

      const warnings: string[] = [];
      const { fs, manifestRepo, loader, hasher } = buildDeps(projectRoot);
      const logger = { debug: () => {}, info: () => {}, warn: (m: string) => warnings.push(m) };
      await new InitUseCase(fs, manifestRepo, loader, hasher, logger).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });
      expect(warnings.some((w) => w.includes("Overwriting modified file"))).toBe(true);
    });

    it("updates tracked version after re-copy", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });
      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as { docs: { version: string } };
      expect(data.docs.version).toBe("test-v2");
    });

    it("does not touch tool distributions", async () => {
      const { fs, manifestRepo, loader, hasher, logger } = buildDeps(projectRoot);
      const initUseCase = new InitUseCase(fs, manifestRepo, loader, hasher, logger);
      await initUseCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      const { InstallUseCase } = await import(
        "../../../src/application/use-cases/install-use-case.js"
      );
      const installUseCase = new InstallUseCase(fs, manifestRepo, loader, hasher, logger);
      await installUseCase.execute({
        toolIds: ["claude" as import("../../../src/domain/models/tool-config.js").ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      const rawBefore = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const toolsBefore = (JSON.parse(rawBefore) as { tools: Record<string, unknown> }).tools;

      await initUseCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const rawAfter = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const toolsAfter = (JSON.parse(rawAfter) as { tools: Record<string, unknown> }).tools;
      expect(JSON.stringify(toolsAfter)).toBe(JSON.stringify(toolsBefore));
    });

    it("fails with guidance when no manifest exists", async () => {
      await expect(
        buildUseCase().execute({
          frameworkPath: FIXTURE_DIR,
          version: "test",
          docsDir: "aidd_docs",
          projectRoot,
          force: true,
        })
      ).rejects.toThrow("No AIDD installation found");
    });
  });

  it("creates CATALOG.md in docsDir after init", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const catalogPath = join(projectRoot, "aidd_docs", "CATALOG.md");
    expect(existsSync(catalogPath)).toBe(true);

    const content = await readFile(catalogPath, "utf-8");
    expect(content).toContain("# AIDD Framework Catalog");
    expect(content).toContain("Generated by `aidd`");
  });

  it("generates CATALOG.md without tracking it as an installed file", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    expect(raw).not.toContain("CATALOG.md");
  });

  it("fails if already initialized without --force", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "my_docs",
        projectRoot,
      })
    ).rejects.toThrow("Already initialized");
  });

  it("shows recovery options when already initialized", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    await expect(
      buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow(
      /aidd init --force.*aidd clean --force|aidd clean --force.*aidd init --force/
    );
  });

  it("creates files under a custom docs directory", async () => {
    await buildUseCase().execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "my_docs",
      projectRoot,
    });

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    const data = JSON.parse(raw) as { docs: { files: { relativePath: string }[] } };
    expect(data.docs.files.some((f) => f.relativePath.startsWith("my_docs/"))).toBe(true);
  });
});
