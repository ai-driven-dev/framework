import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstallUseCase } from "../../../src/application/use-cases/install/install-use-case.js";
import { UninstallUseCase } from "../../../src/application/use-cases/uninstall-use-case.js";
import type { ToolId } from "../../../src/domain/tools/registry.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initProject,
  linuxPlatform,
} from "./helpers.js";

const CATALOG = (root: string) => join(root, "aidd_docs", "CATALOG.md");

async function install(projectRoot: string, ...toolIds: ToolId[]): Promise<void> {
  const deps = buildDeps(projectRoot);
  await initProject(deps, projectRoot);
  const useCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    linuxPlatform,
    undefined,
    deps.pluginFetcher,
    deps.pluginDistributionReader,
    deps.pluginCatalogRepository
  );
  await useCase.execute({
    toolIds,
    frameworkPath: FIXTURE_DIR,
    version: "test",
    docsDir: "aidd_docs",
    projectRoot,
    mcpFilter: ["playwright", "github"],
  });
}

describe("CATALOG.md — content", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("organizes files by framework content type, not by tool name", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).toContain("### `agents`");
    expect(content).toContain("### `commands`");
    expect(content).toContain("### `rules`");
    expect(content).toContain("### `skills`");
    expect(content).not.toContain("## Claude");
    expect(content).not.toContain("## Copilot");
  });

  it("shows file descriptions from frontmatter as table column", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).toContain("| Description |");
    expect(content).toContain("`Reviews code for quality and correctness.`");
    expect(content).toContain("`Implement a feature from a plan.`");
  });

  it("creates a subfolder subsection for commands with subdirectories", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).toContain("#### `commands/04`");
  });

  it("includes a table of contents with links to all sections", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).toContain("## Table of Contents");
    expect(content).toContain("- [agents](#agents)");
    expect(content).toContain("- [commands](#commands)");
  });

  it("merges same framework file from two tools into one row with an Installed column", async () => {
    await install(projectRoot, "claude", "copilot");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    // Installed column header appears
    expect(content).toContain("| Installed |");
    // Tool-named links in the same row
    expect(content).toContain("[claude]");
    expect(content).toContain("[copilot]");
    expect(content).toContain(" · ");

    // No separate per-tool top-level sections
    expect(content).not.toContain("## Claude");
    expect(content).not.toContain("## Copilot");
  });

  it("removes a tool's files from catalog when it is uninstalled", async () => {
    await install(projectRoot, "claude", "copilot");
    const deps = buildDeps(projectRoot);

    const uninstall = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await uninstall.execute({ toolIds: ["copilot"], projectRoot, mcpFilter: [] });

    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).toContain("../.claude/");
    expect(content).not.toContain("../.github/");
  });

  it("shows 'No content installed' when no tools are installed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).toContain("No content installed.");
    expect(content).not.toContain("###");
  });

  it("excludes .gitkeep placeholder files from catalog", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).not.toContain(".gitkeep");
  });

  it("excludes files installed in hidden directories (config files like .vscode, .mcp)", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    expect(content).not.toContain(".vscode");
    expect(content).not.toContain("mcp.json");
  });

  it("generates correct relative links from aidd_docs to installed files", async () => {
    await install(projectRoot, "claude");
    const content = await readFile(CATALOG(projectRoot), "utf-8");

    // Links must be relative from aidd_docs/ → ../.claude/
    expect(content).toMatch(/\[code-reviewer\.md\]\(\.\.\/\.claude\//);
  });
});
