import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallUseCase } from "../../../src/application/use-cases/install/install-use-case.js";
import { UninstallUseCase } from "../../../src/application/use-cases/uninstall-use-case.js";
import type { ToolId } from "../../../src/domain/tools/registry.js";
import {
  buildUnitDeps,
  FIXTURE_DIR,
  initProject,
} from "../../helpers/ports/build-unit-deps.js";
import { FakePlatform } from "../../helpers/ports/fake-platform.js";

const PROJECT_ROOT = "/test-project";
const CATALOG = join(PROJECT_ROOT, "aidd_docs", "CATALOG.md");

async function install(toolIds: ToolId[]): Promise<Awaited<ReturnType<typeof buildUnitDeps>>> {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initProject(deps, PROJECT_ROOT);
  const useCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    new FakePlatform("linux"),
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
    projectRoot: PROJECT_ROOT,
    mcpFilter: ["playwright", "github"],
  });
  return deps;
}

describe("CATALOG.md — content", () => {
  it("organizes files by framework content type, not by tool name", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toContain("### `agents`");
    expect(content).toContain("### `commands`");
    expect(content).toContain("### `rules`");
    expect(content).toContain("### `skills`");
    expect(content).not.toContain("## Claude");
    expect(content).not.toContain("## Copilot");
  });

  it("shows file descriptions from frontmatter as table column", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toContain("| Description |");
    expect(content).toContain("`Reviews code for quality and correctness.`");
    expect(content).toContain("`Implement a feature from a plan.`");
  });

  it("creates a subfolder subsection for commands with subdirectories", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toContain("#### `commands/04`");
  });

  it("includes a table of contents with links to all sections", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toContain("## Table of Contents");
    expect(content).toContain("- [agents](#agents)");
    expect(content).toContain("- [commands](#commands)");
  });

  it("merges same framework file from two tools into one row with an Installed column", async () => {
    const deps = await install(["claude" as ToolId, "copilot" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toContain("| Installed |");
    expect(content).toContain("[claude]");
    expect(content).toContain("[copilot]");
    expect(content).toContain(" · ");
    expect(content).not.toContain("## Claude");
    expect(content).not.toContain("## Copilot");
  });

  it("removes a tool's files from catalog when it is uninstalled", async () => {
    const deps = await install(["claude" as ToolId, "copilot" as ToolId]);

    const uninstall = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await uninstall.execute({ toolIds: ["copilot" as ToolId], projectRoot: PROJECT_ROOT, mcpFilter: [] });

    const content = deps.fs.getFile(CATALOG) ?? "";
    expect(content).toContain("../.claude/");
    expect(content).not.toContain("../.github/");
  });

  it("shows 'No content installed' when no tools are installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toContain("No content installed.");
    expect(content).not.toContain("###");
  });

  it("excludes .gitkeep placeholder files from catalog", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).not.toContain(".gitkeep");
  });

  it("excludes files installed in hidden directories (config files like .vscode, .mcp)", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).not.toContain(".vscode");
    expect(content).not.toContain("mcp.json");
  });

  it("generates correct relative links from aidd_docs to installed files", async () => {
    const deps = await install(["claude" as ToolId]);
    const content = deps.fs.getFile(CATALOG) ?? "";

    expect(content).toMatch(/\[code-reviewer\.md\]\(\.\.\/\.claude\//);
  });
});
