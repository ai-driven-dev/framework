import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateUseCase } from "../../../src/application/use-cases/update-use-case.js";
import type { McpExclusion } from "../../../src/domain/models/mcp-exclusion.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import {
  BackupPrompter,
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
  noGit,
  OverwritePrompter,
  SkipPrompter,
} from "./helpers.js";

describe("update", () => {
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
      noGit,
      linuxPlatform,
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
    );

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd setup");
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
      noGit,
      linuxPlatform,
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
      noGit,
      linuxPlatform,
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
      noGit,
      linuxPlatform,
      new SkipPrompter()
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
      noGit,
      linuxPlatform,
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
      noGit,
      linuxPlatform,
      new BackupPrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const toolResult = result.tools.find((t) => t.toolId === "claude");
    expect(toolResult?.backedUp.length).toBeGreaterThan(0);
    expect(toolResult?.backedUp[0]).toMatch(/naming\.md\.bak\.\d{8}T\d{6}/);

    const backedUpRelative = toolResult?.backedUp[0];
    if (!backedUpRelative) throw new Error("Expected a backed up path");
    const backupPath = join(projectRoot, backedUpRelative);
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
      noGit,
      linuxPlatform,
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
      noGit,
      linuxPlatform,
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

  it("docs: detects and writes changed docs file when updating to newer framework", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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
      noGit,
      linuxPlatform,
      new BackupPrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs?.backedUp.some((f) => f.includes("README.md"))).toBe(true);
    const backedUpRelative = result.docs?.backedUp.find((f) => f.includes("README.md"));
    if (!backedUpRelative) throw new Error("Expected a backed up README.md path");
    const backupPath = join(projectRoot, backedUpRelative);
    expect(existsSync(backupPath)).toBe(true);
    const backupContent = await readFile(backupPath, "utf-8");
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
      noGit,
      linuxPlatform,
      new SkipPrompter()
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
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

  it("does not overwrite a pre-existing user file when the framework adds it as a new file", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const assertPath = join(projectRoot, ".claude/commands/aidd/04/assert.md");
    await mkdir(join(projectRoot, ".claude/commands/aidd/04"), { recursive: true });
    await writeFile(assertPath, "user content");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform,
      new OverwritePrompter()
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const content = await readFile(assertPath, "utf-8");
    expect(content).toBe("user content");
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
      noGit,
      linuxPlatform,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.docs).toBeNull();
  });

  describe("per-entry merge file tracking", () => {
    it("surgically removes dropped unmodified MCP server from disk", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new OverwritePrompter()
      );
      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const mcpContent = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf-8"));
      expect(mcpContent.mcpServers.github).toBeUndefined();
      expect(mcpContent.mcpServers.playwright).toBeDefined();
      expect(mcpContent.mcpServers.slack).toBeDefined();
    });

    it("stores updated per-entry hashes in manifest after update", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new OverwritePrompter()
      );
      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as {
        tools: Record<
          string,
          {
            mergeFiles: Array<{
              relativePath: string;
              entries: Record<string, string>;
            }>;
          }
        >;
      };
      const mcpEntry = data.tools.claude.mergeFiles.find((m) => m.relativePath === ".mcp.json");
      expect(mcpEntry).toBeDefined();
      expect(mcpEntry?.entries).toHaveProperty("playwright");
      expect(mcpEntry?.entries).toHaveProperty("slack");
      expect(mcpEntry?.entries).not.toHaveProperty("github");
    });

    it("prompts for conflict when dropping a user-modified MCP server entry", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const mcpPath = join(projectRoot, ".mcp.json");
      const mcpContent = JSON.parse(await readFile(mcpPath, "utf-8"));
      mcpContent.mcpServers.github = { command: "gh", args: ["mcp", "--custom-flag"] };
      await writeFile(mcpPath, JSON.stringify(mcpContent, null, 2));

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new SkipPrompter()
      );
      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const updatedMcp = JSON.parse(await readFile(mcpPath, "utf-8"));
      expect(updatedMcp.mcpServers.github).toBeDefined();
      expect(updatedMcp.mcpServers.github.args).toContain("--custom-flag");
    });

    it("dry-run reports dropped merge entries without applying", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new OverwritePrompter()
      );
      const result = await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        dryRun: true,
      });

      const entryRemoved = result.tools[0].diff.find(
        (d) => d.kind === "removed" && d.relativePath.includes(".mcp.json > github")
      );
      expect(entryRemoved).toBeDefined();

      const mcpContent = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf-8"));
      expect(mcpContent.mcpServers.github).toBeDefined();
    });

    it("preserves user-added MCP servers during update", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const mcpPath = join(projectRoot, ".mcp.json");
      const mcpContent = JSON.parse(await readFile(mcpPath, "utf-8"));
      mcpContent.mcpServers.userCustom = { command: "custom-mcp" };
      await writeFile(mcpPath, JSON.stringify(mcpContent, null, 2));

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new OverwritePrompter()
      );
      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const updatedMcp = JSON.parse(await readFile(mcpPath, "utf-8"));
      expect(updatedMcp.mcpServers.userCustom).toBeDefined();
      expect(updatedMcp.mcpServers.slack).toBeDefined();
    });
  });

  describe("MCP exclusion", () => {
    function addExclusionToManifest(
      manifestData: Record<string, unknown>,
      toolId: string,
      exclusions: McpExclusion[]
    ): void {
      const tools = manifestData.tools as Record<string, Record<string, unknown>>;
      tools[toolId].excludedMcp = exclusions.map((e) => ({
        configPath: e.configPath,
        entryKey: e.entryKey,
      }));
    }

    class CheckboxTrackingPrompter implements Prompter {
      readonly checkboxCalls: Array<{
        message: string;
        choices: Array<{ name: string; value: unknown; checked?: boolean }>;
      }> = [];
      private readonly acceptAll: boolean;

      constructor(acceptAll = true) {
        this.acceptAll = acceptAll;
      }

      async resolveConflict(
        _relativePath: string,
        _reason: "deleted" | "modified"
      ): Promise<"keep" | "overwrite"> {
        return "overwrite";
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
        if (!first) throw new Error("No enabled choices");
        return first.value;
      }

      async checkbox<T>(
        message: string,
        choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
      ): Promise<T[]> {
        this.checkboxCalls.push({
          message,
          choices: choices.map((c) => ({ name: c.name, value: c.value, checked: c.checked })),
        });
        if (this.acceptAll) {
          return choices.filter((c) => c.checked && !c.disabled).map((c) => c.value);
        }
        return [];
      }
    }

    it("skips excluded MCP entries during update", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const manifestPath = join(projectRoot, ".aidd", "manifest.json");
      const rawManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      addExclusionToManifest(rawManifest, "claude", [
        { configPath: ".mcp.json", entryKey: "github" },
      ]);
      await writeFile(manifestPath, JSON.stringify(rawManifest));

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new OverwritePrompter()
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const mcpContent = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf-8"));
      expect(mcpContent.mcpServers.playwright).toBeDefined();
      expect(mcpContent.mcpServers.github).toBeUndefined();
    });

    it("prompts for genuinely new MCP entries in interactive mode", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const prompter = new CheckboxTrackingPrompter(true);
      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        prompter
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(prompter.checkboxCalls.length).toBeGreaterThan(0);
      const mcpCall = prompter.checkboxCalls.find((c) => c.message.includes("MCP"));
      expect(mcpCall).toBeDefined();
      expect(mcpCall?.choices.some((c) => c.name === "slack")).toBe(true);
    });

    it("clears exclusions and installs all when using --force", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const manifestPath = join(projectRoot, ".aidd", "manifest.json");
      const rawManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      addExclusionToManifest(rawManifest, "claude", [
        { configPath: ".mcp.json", entryKey: "playwright" },
      ]);
      await writeFile(manifestPath, JSON.stringify(rawManifest));

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        new OverwritePrompter()
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const mcpContent = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf-8"));
      expect(mcpContent.mcpServers.playwright).toBeDefined();
      expect(mcpContent.mcpServers.github).toBeDefined();

      const updatedManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const toolData = updatedManifest.tools.claude;
      expect(toolData.excludedMcp ?? []).toHaveLength(0);
    });

    it("includes new entries without prompt in non-interactive mode", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const prompter = new CheckboxTrackingPrompter(true);
      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        prompter
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: false,
      });

      expect(prompter.checkboxCalls).toHaveLength(0);

      const mcpContent = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf-8"));
      expect(mcpContent.mcpServers.slack).toBeDefined();
    });

    it("adds declined entries to excludedMcp when user deselects them", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const declineAllPrompter = new CheckboxTrackingPrompter(false);
      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        declineAllPrompter
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      const manifestPath = join(projectRoot, ".aidd", "manifest.json");
      const updatedManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const excluded = updatedManifest.tools.claude.excludedMcp ?? [];
      expect(excluded.some((e: McpExclusion) => e.entryKey === "slack")).toBe(true);

      const mcpContent = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf-8"));
      expect(mcpContent.mcpServers.slack).toBeUndefined();
    });
  });
});
