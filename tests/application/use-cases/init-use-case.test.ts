import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  linuxPlatform,
  noGit,
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

  describe("checkPreconditions", () => {
    it("passes when directory is truly empty", async () => {
      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).resolves.toBeUndefined();
    });

    it("passes when only .aidd/cache/ exists (created by resolver before init runs)", async () => {
      await mkdir(join(projectRoot, ".aidd", "cache"), { recursive: true });

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).resolves.toBeUndefined();
    });

    it("aborts with adopt guidance when docs directory already exists", async () => {
      await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).rejects.toThrow("Repository:");
    });

    it("aborts with adopt guidance when .claude/ contains AIDD frontmatter", async () => {
      const commandDir = join(projectRoot, ".claude", "commands", "aidd", "02");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).rejects.toThrow("Repository:");
    });

    it("aborts with adopt guidance when .opencode/ contains AIDD frontmatter", async () => {
      const commandDir = join(projectRoot, ".opencode", "commands", "aidd", "02");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).rejects.toThrow("AIDD files detected but no manifest found");
    });

    it("passes when .claude/ exists without AIDD frontmatter", async () => {
      const commandDir = join(projectRoot, ".claude", "commands");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "my-command.md"),
        "---\nname: my-command\ndescription: custom\n---\nbody"
      );

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).resolves.toBeUndefined();
    });

    it("error message contains recovery command when AIDD files detected", async () => {
      const commandDir = join(projectRoot, ".opencode", "commands", "aidd", "02");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).rejects.toThrow("aidd setup");
    });

    it("aborts when .github/prompts/ contains legacy underscore-format AIDD frontmatter", async () => {
      const promptsDir = join(projectRoot, ".github", "prompts");
      await mkdir(promptsDir, { recursive: true });
      await writeFile(
        join(promptsDir, "aidd_02_brainstorm.prompt.md"),
        "---\nname: aidd_02_brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).rejects.toThrow("AIDD files detected but no manifest found");
    });

    it("uses custom repo in AiddFilesDetectedError", async () => {
      const commandDir = join(projectRoot, ".opencode", "commands", "aidd", "02");
      await mkdir(commandDir, { recursive: true });
      await writeFile(
        join(commandDir, "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        buildUseCase().checkPreconditions({
          docsDir: "aidd_docs",
          projectRoot,
          repo: "myorg/my-repo",
        })
      ).rejects.toThrow("myorg/my-repo");
    });

    it("aborts when already initialized without --force", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
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
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot })
      ).rejects.toThrow(
        /aidd init --force.*aidd clean --force|aidd clean --force.*aidd init --force/
      );
    });

    it("--force: fails with guidance when no manifest exists", async () => {
      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot, force: true })
      ).rejects.toThrow("No AIDD manifest found");
    });

    it("--force: passes when manifest exists", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      await expect(
        buildUseCase().checkPreconditions({ docsDir: "aidd_docs", projectRoot, force: true })
      ).resolves.toBeUndefined();
    });
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

    it("uses existing docsDir when --force without explicit --docs-dir", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "my_docs",
        projectRoot,
      });
      const result = await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        // explicitDocsDir not set → should fall back to existing.docsDir ("my_docs")
        projectRoot,
        force: true,
      });
      expect(result.docsDir).toBe("my_docs");
      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      expect(data.docsDir).toBe("my_docs");
    });

    it("moves docs to new dir when --force with explicit --docs-dir", async () => {
      await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });
      const result = await buildUseCase().execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "docs",
        explicitDocsDir: "docs",
        projectRoot,
        force: true,
      });
      expect(result.docsDir).toBe("docs");
      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      expect(data.docsDir).toBe("docs");
      expect(existsSync(join(projectRoot, "docs"))).toBe(true);
    });

    it("deletes docs files from old version that are absent in new framework", async () => {
      const { fs, manifestRepo, loader, hasher, logger } = buildDeps(projectRoot);
      const useCase = new InitUseCase(fs, manifestRepo, loader, hasher, logger);

      await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      // Inject an extra tracked docs file that the new framework won't have
      const extraPath = join(projectRoot, "aidd_docs", "old-file.md");
      await writeFile(extraPath, "old content");
      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as {
        docs: { version: string; files: { relativePath: string; hash: string }[] };
      };
      data.docs.files.push({ relativePath: "aidd_docs/old-file.md", hash: "a".repeat(32) });
      await writeFile(join(projectRoot, ".aidd", "manifest.json"), JSON.stringify(data));

      // Force re-init with same fixture (which doesn't include old-file.md)
      await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      expect(existsSync(extraPath)).toBe(false);
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
      const installUseCase = new InstallUseCase(
        fs,
        manifestRepo,
        loader,
        hasher,
        logger,
        noGit,
        linuxPlatform
      );
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
    expect(content).toContain("automatically updated by `aidd`");
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
