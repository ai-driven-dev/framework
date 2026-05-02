import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateUseCase } from "../../../src/application/use-cases/update/update-use-case.js";
import type { McpExclusion } from "../../../src/domain/models/mcp-exclusion.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  FIXTURE_DIR_V2,
  initAndInstall,
  initProject,
  installTool,
  linuxPlatform,
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
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.assetProvider
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
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.assetProvider
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
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.assetProvider
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

  it("processes all installed tools in update", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.assetProvider
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

  it("toolIds filter limits update to specific tool", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const useCase = new UpdateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.assetProvider
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
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.assetProvider
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

  describe("per-entry merge file tracking", () => {
    it("surgically removes dropped unmodified MCP server from disk", async () => {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new SkipPrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        prompter,
        deps.assetProvider
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(prompter.checkboxCalls).toHaveLength(1);
      expect(prompter.checkboxCalls[0].message).toContain("not yet installed");
      expect(prompter.checkboxCalls[0].choices.some((c) => c.name === "slack")).toBe(true);
    });

    it("shows single MCP prompt when two tools have the same new MCP entry", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "claude");
      await installTool(deps, projectRoot, "cursor");

      const prompter = new CheckboxTrackingPrompter(true);
      const useCase = new UpdateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        prompter,
        deps.assetProvider
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR_V2,
        version: "test-v2",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(prompter.checkboxCalls).toHaveLength(1);
      expect(prompter.checkboxCalls[0].message).toContain("not yet installed");
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter(),
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        prompter,
        deps.assetProvider
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
        deps.hasher,
        deps.logger,
        linuxPlatform,
        declineAllPrompter,
        deps.assetProvider
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
