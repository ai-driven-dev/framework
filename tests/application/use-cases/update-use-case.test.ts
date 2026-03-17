import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateUseCase } from "../../../src/application/use-cases/update-use-case.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  FIXTURE_DIR_V2,
  initAndInstall,
  initProject,
  installTool,
  KeepPrompter,
  linuxPlatform,
  OverwritePrompter,
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
      new OverwritePrompter(),
      linuxPlatform
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
      new OverwritePrompter(),
      linuxPlatform
    );

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd adopt --from <version> --tools <tool>");
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
      new OverwritePrompter(),
      linuxPlatform
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
      new OverwritePrompter(),
      linuxPlatform
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
      new KeepPrompter(),
      linuxPlatform
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
      new OverwritePrompter(),
      linuxPlatform
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
      new OverwritePrompter(),
      linuxPlatform
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
      new KeepPrompter(),
      linuxPlatform
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
      new OverwritePrompter(),
      linuxPlatform
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

  it("docs: detects and writes changed docs file when updating to newer framework", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs).not.toBeNull();
    expect(result.docs?.alreadyUpToDate).toBe(false);
    expect(result.docs?.written.length).toBeGreaterThan(0);
    // README.md was changed in v2
    expect(result.docs?.written.some((f) => f.includes("README.md"))).toBe(true);

    const readmePath = join(projectRoot, "aidd_docs/README.md");
    const content = await readFile(readmePath, "utf-8");
    expect(content).toContain("v2 Update");
  });

  it("docs: reports alreadyUpToDate when docs have not changed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs).not.toBeNull();
    expect(result.docs?.alreadyUpToDate).toBe(true);
    expect(result.docs?.written).toHaveLength(0);
  });

  it("docs: creates backup when user-modified docs file conflicts with framework update", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    // Simulate user modifying README.md
    const readmePath = join(projectRoot, "aidd_docs/README.md");
    await writeFile(readmePath, "user modified docs content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs?.backedUp.some((f) => f.includes("README.md"))).toBe(true);
    expect(existsSync(`${readmePath}.backup`)).toBe(true);
    const backupContent = await readFile(`${readmePath}.backup`, "utf-8");
    expect(backupContent).toBe("user modified docs content");
  });

  it("docs: keeps user-modified docs file when prompter returns keep", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const readmePath = join(projectRoot, "aidd_docs/README.md");
    await writeFile(readmePath, "user modified docs content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new KeepPrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs?.kept.some((f) => f.includes("README.md"))).toBe(true);
    const content = await readFile(readmePath, "utf-8");
    expect(content).toBe("user modified docs content");
  });

  it("toolIds filter limits update to specific tool and skips docs", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const readmePath = join(projectRoot, "aidd_docs/README.md");
    await writeFile(readmePath, "modified readme");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      toolIds: ["claude"],
    });

    // only the specified tool is processed
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].toolId).toBe("claude");

    // docs must be null when explicit toolIds filter is active
    expect(result.docs).toBeNull();

    // docs file must remain modified
    const content = await readFile(readmePath, "utf-8");
    expect(content).toBe("modified readme");
  });

  it("docsOnly=true skips all tools and updates docs", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
      docsOnly: true,
    });

    // tools must be skipped entirely
    expect(result.tools).toHaveLength(0);

    // docs must be processed and updated
    expect(result.docs).not.toBeNull();
    expect(result.docs?.written.some((f) => f.includes("README.md"))).toBe(true);
  });

  it("re-installs a file deleted on disk even when unchanged in framework", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    const { unlink } = await import("node:fs/promises");
    await unlink(rulePath);

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const toolResult = result.tools.find((t) => t.toolId === "claude");
    expect(toolResult?.written).toContain(".claude/rules/01-standards/naming.md");
    expect(existsSync(rulePath)).toBe(true);
  });

  it("treats disk-modified file as conflict when unchanged in framework", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(rulePath, "user modified rule content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const toolResult = result.tools.find((t) => t.toolId === "claude");
    const ruleDiff = toolResult?.diff.find(
      (d) => d.relativePath === ".claude/rules/01-standards/naming.md"
    );
    expect(ruleDiff?.kind).toBe("changed");
    expect(ruleDiff?.conflict).toBe(true);
    expect(toolResult?.backedUp.some((f) => f.includes("naming.md"))).toBe(true);
    expect(toolResult?.written).toContain(".claude/rules/01-standards/naming.md");
  });

  it("docs: re-installs a docs file deleted on disk even when unchanged in framework", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const readmePath = join(projectRoot, "aidd_docs/README.md");
    const { unlink } = await import("node:fs/promises");
    await unlink(readmePath);

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs?.written.some((f) => f.includes("README.md"))).toBe(true);
    expect(existsSync(readmePath)).toBe(true);
  });

  it("docs: returns null for docs when manifest has no docs", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    // Strip docs from manifest to simulate a manifest without docs tracking
    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as Record<string, unknown>;
    manifestData.docs = null;
    await writeFile(manifestPath, JSON.stringify(manifestData));

    const manifest = await deps.manifestRepo.load();
    expect(manifest?.hasDocs()).toBe(false);

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter(),
      linuxPlatform
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs).toBeNull();
  });
});
