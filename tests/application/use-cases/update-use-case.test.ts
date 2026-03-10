import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateUseCase } from "../../../src/application/use-cases/update-use-case.js";
import {
  FIXTURE_DIR,
  KeepPrompter,
  OverwritePrompter,
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  initProject,
} from "./helpers.js";

describe("UpdateUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("reports already up to date when no files changed", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.alreadyUpToDate).toBe(true);
    expect(result.tools.every((t) => t.alreadyUpToDate)).toBe(true);
  });

  it("aborts if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);
    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("No AIDD installation found");
  });

  it("dry run returns dryRun=true and writes nothing", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.tools[0].written).toHaveLength(0);
  });

  it("detects conflict when framework AND user both changed a file", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    // Simulate: user modifies a rule file AND manifest hash is set to old hash
    // by writing a different hash to manifest
    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as {
      tools: Record<
        string,
        { version: string; files: Array<{ relativePath: string; hash: string }> }
      >;
    };

    // Change the manifest hash for naming.md to simulate framework update
    const ruleFile = manifestData.tools.claude.files.find(
      (f) => f.relativePath === ".claude/rules/01-standards/naming.md"
    );
    if (ruleFile) {
      ruleFile.hash = "00000000000000000000000000000000";
    }
    await writeFile(manifestPath, JSON.stringify(manifestData));

    // Also modify the disk file to simulate user modification
    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(rulePath, "user modified rule content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    // With force=true, conflicting file should be overwritten
    const ruleDiff = result.tools[0].diff.find(
      (d) => d.relativePath === ".claude/rules/01-standards/naming.md"
    );
    expect(ruleDiff?.kind).toBe("changed");
    expect(result.tools[0].written).toContain(".claude/rules/01-standards/naming.md");
  });

  it("keeps conflict file when prompter returns keep", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    // Simulate framework update by corrupting manifest hash
    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as {
      tools: Record<
        string,
        { version: string; files: Array<{ relativePath: string; hash: string }> }
      >;
    };
    const ruleFile = manifestData.tools.claude.files.find(
      (f) => f.relativePath === ".claude/rules/01-standards/naming.md"
    );
    if (ruleFile) ruleFile.hash = "00000000000000000000000000000000";
    await writeFile(manifestPath, JSON.stringify(manifestData));

    // Modify disk file to simulate user modification
    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(rulePath, "user modified rule content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new KeepPrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const contentAfter = await readFile(rulePath, "utf-8");
    expect(contentAfter).toBe("user modified rule content");

    const keptTool = result.tools.find((t) => t.kept.length > 0);
    expect(keptTool).toBeDefined();
  });

  it("marks file as removed and deletes it when no longer in framework distribution", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as {
      tools: Record<
        string,
        { version: string; files: Array<{ relativePath: string; hash: string }> }
      >;
    };
    manifestData.tools.claude.files.push({
      relativePath: ".claude/rules/fake-rule.md",
      hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    await writeFile(manifestPath, JSON.stringify(manifestData));

    const fakePath = join(projectRoot, ".claude/rules/fake-rule.md");
    await writeFile(fakePath, "fake content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );
    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const toolResult = result.tools.find((t) => t.toolId === "claude");
    expect(toolResult?.deleted).toContain(".claude/rules/fake-rule.md");
    expect(existsSync(fakePath)).toBe(false);
  });

  it("creates a .backup file when overwriting a user-modified conflicting file", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as {
      tools: Record<
        string,
        { version: string; files: Array<{ relativePath: string; hash: string }> }
      >;
    };

    const ruleFile = manifestData.tools.claude.files.find(
      (f) => f.relativePath === ".claude/rules/01-standards/naming.md"
    );
    if (ruleFile) {
      ruleFile.hash = "00000000000000000000000000000000";
    }
    await writeFile(manifestPath, JSON.stringify(manifestData));

    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(rulePath, "user modified rule content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const toolResult = result.tools.find((t) => t.toolId === "claude");
    expect(toolResult?.backedUp.length).toBeGreaterThan(0);
    expect(toolResult?.backedUp[0]).toContain(".backup");

    const backupPath = join(projectRoot, ".claude/rules/01-standards/naming.md.backup");
    const backupContent = await readFile(backupPath, "utf-8");
    expect(backupContent).toBe("user modified rule content");
  });

  it("does not create .backup when user keeps the conflict file", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as {
      tools: Record<
        string,
        { version: string; files: Array<{ relativePath: string; hash: string }> }
      >;
    };
    const ruleFile = manifestData.tools.claude.files.find(
      (f) => f.relativePath === ".claude/rules/01-standards/naming.md"
    );
    if (ruleFile) ruleFile.hash = "00000000000000000000000000000000";
    await writeFile(manifestPath, JSON.stringify(manifestData));

    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(rulePath, "user modified rule content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new KeepPrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const toolResult = result.tools.find((t) => t.toolId === "claude");
    expect(toolResult?.backedUp).toHaveLength(0);

    const { existsSync } = await import("node:fs");
    const backupPath = join(projectRoot, ".claude/rules/01-standards/naming.md.backup");
    expect(existsSync(backupPath)).toBe(false);
  });

  it("processes all installed tools in update", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.tools[0].toolId).toBe("claude");
  });
});
