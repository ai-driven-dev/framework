import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { DOCS_DIR } from "../../../src/domain/models/paths.js";
import type { ToolId } from "../../../src/domain/tools/registry.js";
import { buildUnitDeps, initProject, installTool } from "../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

describe("init", () => {
  it("creates an empty docs directory and a v5 manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const result = await new InitUseCase(deps.fs, deps.manifestRepo).execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result.docsDir).toBe(DOCS_DIR);
    expect(deps.fs.has(join(PROJECT_ROOT, DOCS_DIR, "CATALOG.md"))).toBe(true);

    const manifest = await deps.manifestRepo.load();
    expect(manifest).not.toBeNull();
    // Manifest is stored in memory — check via the InMemoryManifestRepository
    const tools = manifest?.getInstalledToolIds() ?? [];
    expect(tools).toHaveLength(0);
  });

  it("does not copy any framework docs files into the project", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await new InitUseCase(deps.fs, deps.manifestRepo).execute({ projectRoot: PROJECT_ROOT });

    const docsFiles = deps.fs
      .listUnder(join(PROJECT_ROOT, DOCS_DIR))
      .map((p) => p.replace(`${join(PROJECT_ROOT, DOCS_DIR)}/`, ""));
    expect(docsFiles).toEqual(["CATALOG.md"]);
  });

  it("does not overwrite a pre-existing user file in the docs dir", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const docFile = join(PROJECT_ROOT, DOCS_DIR, "README.md");
    await deps.fs.writeFile(docFile, "custom content");

    await new InitUseCase(deps.fs, deps.manifestRepo).execute({ projectRoot: PROJECT_ROOT });

    expect(deps.fs.getFile(docFile)).toBe("custom content");
  });

  it("generates CATALOG.md without tracking it in the manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await new InitUseCase(deps.fs, deps.manifestRepo).execute({ projectRoot: PROJECT_ROOT });

    const catalogPath = join(PROJECT_ROOT, DOCS_DIR, "CATALOG.md");
    expect(deps.fs.has(catalogPath)).toBe(true);
    const content = deps.fs.getFile(catalogPath) ?? "";
    expect(content).toContain("# AIDD Framework Catalog");

    // Manifest should not contain CATALOG.md in tracked files
    const manifest = await deps.manifestRepo.load();
    const allFiles = (manifest?.getInstalledToolIds() ?? []).flatMap(
      (id) => manifest?.getToolFiles(id) ?? []
    );
    expect(allFiles.every((f) => !f.relativePath.includes("CATALOG.md"))).toBe(true);
  });

  describe("checkPreconditions", () => {
    it("passes when directory is truly empty", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await expect(
        new InitUseCase(deps.fs, deps.manifestRepo).checkPreconditions({
          projectRoot: PROJECT_ROOT,
        })
      ).resolves.toBeUndefined();
    });

    it("aborts with guidance when .claude/ contains AIDD frontmatter", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".claude", "commands", "aidd", "02", "brainstorm.md"),
        "---\nname: aidd:02:brainstorm\ndescription: test\n---\nbody"
      );

      await expect(
        new InitUseCase(deps.fs, deps.manifestRepo).checkPreconditions({
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow("AIDD files detected but no manifest found");
    });

    it("passes when .claude/ exists without AIDD frontmatter", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await deps.fs.writeFile(
        join(PROJECT_ROOT, ".claude", "commands", "my-command.md"),
        "---\nname: my-command\ndescription: custom\n---\nbody"
      );

      await expect(
        new InitUseCase(deps.fs, deps.manifestRepo).checkPreconditions({
          projectRoot: PROJECT_ROOT,
        })
      ).resolves.toBeUndefined();
    });

    it("aborts when already initialized without --force", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await new InitUseCase(deps.fs, deps.manifestRepo).execute({ projectRoot: PROJECT_ROOT });
      await expect(
        new InitUseCase(deps.fs, deps.manifestRepo).checkPreconditions({
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(/Already initialized \(docs in "aidd_docs"\)/);
    });

    it("--force: fails with guidance when no manifest exists", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await expect(
        new InitUseCase(deps.fs, deps.manifestRepo).checkPreconditions({
          projectRoot: PROJECT_ROOT,
          force: true,
        })
      ).rejects.toThrow("No AIDD manifest found");
    });

    it("--force: passes when manifest exists", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await new InitUseCase(deps.fs, deps.manifestRepo).execute({ projectRoot: PROJECT_ROOT });
      await expect(
        new InitUseCase(deps.fs, deps.manifestRepo).checkPreconditions({
          projectRoot: PROJECT_ROOT,
          force: true,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("--force", () => {
    it("preserves existing manifest tools when --force reinitializes", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "claude" as ToolId);

      const manifestBefore = await deps.manifestRepo.load();
      const toolsBefore = manifestBefore?.getInstalledToolIds() ?? [];

      await new InitUseCase(deps.fs, deps.manifestRepo).execute({
        projectRoot: PROJECT_ROOT,
        force: true,
      });

      const manifestAfter = await deps.manifestRepo.load();
      const toolsAfter = manifestAfter?.getInstalledToolIds() ?? [];
      expect(toolsAfter).toEqual(toolsBefore);
    });
  });
});
