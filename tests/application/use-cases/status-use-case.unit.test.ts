import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../../src/application/use-cases/install/install-use-case.js";
import { StatusUseCase } from "../../../src/application/use-cases/status-use-case.js";
import { compareSemver } from "../../../src/domain/models/semver.js";
import type { ToolId } from "../../../src/domain/tools/registry.js";
import {
  buildUnitDeps,
  FIXTURE_DIR,
  initProject,
} from "../../helpers/ports/build-unit-deps.js";
import { FakePlatform } from "../../helpers/ports/fake-platform.js";
import { OverwritePrompter } from "../../helpers/ports/scripted-prompter.js";

const PROJECT_ROOT = "/test-project";

async function installTools(deps: Awaited<ReturnType<typeof buildUnitDeps>>, toolIds: ToolId[]) {
  const installUseCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    new FakePlatform("linux")
  );
  await installUseCase.execute({
    toolIds,
    frameworkPath: FIXTURE_DIR,
    version: "test",
    docsDir: "aidd_docs",
    projectRoot: PROJECT_ROOT,
  });
}

describe("status", () => {
  it("does not report .vscode/settings.json as drifted when shared by claude and copilot", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTools(deps, ["claude" as ToolId, "copilot" as ToolId]);

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
    const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(report.inSync).toBe(true);
    for (const tool of report.tools) {
      const settingsDrift = tool.drifted.find((f) =>
        f.relativePath.includes(".vscode/settings.json")
      );
      expect(settingsDrift).toBeUndefined();
    }
  });

  it("reports no drift when no tools are installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await new InitUseCase(deps.fs, deps.manifestRepo).execute({ projectRoot: PROJECT_ROOT });

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
    const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(report.tools).toHaveLength(0);
    expect(report.inSync).toBe(true);
  });

  describe("per-entry merge file drift", () => {
    it("reports no drift when framework MCP entries are unmodified", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTools(deps, ["claude" as ToolId]);

      const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
      const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(report.inSync).toBe(true);
    });

    it("ignores user-added MCP servers (no drift reported)", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTools(deps, ["claude" as ToolId]);

      const mcpPath = join(PROJECT_ROOT, ".mcp.json");
      const mcpContent = JSON.parse(deps.fs.getFile(mcpPath) ?? "{}") as {
        mcpServers: Record<string, unknown>;
      };
      mcpContent.mcpServers.customServer = { command: "custom-mcp" };
      await deps.fs.writeFile(mcpPath, JSON.stringify(mcpContent, null, 2));

      const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
      const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

      const mcpDrift = report.tools[0].drifted.filter((d) => d.relativePath.includes(".mcp.json"));
      expect(mcpDrift).toHaveLength(0);
    });

    it("detects modified framework MCP server entry", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);

      const installUseCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        new FakePlatform("linux"),
        new OverwritePrompter(),
        deps.pluginFetcher,
        deps.pluginDistributionReader,
        deps.pluginCatalogRepository
      );
      await installUseCase.execute({
        toolIds: ["claude" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot: PROJECT_ROOT,
        mcpFilter: ["playwright", "github"],
      });

      const mcpPath = join(PROJECT_ROOT, ".mcp.json");
      const mcpContent = JSON.parse(deps.fs.getFile(mcpPath) ?? "{}") as {
        mcpServers: Record<string, unknown>;
      };
      (mcpContent.mcpServers.playwright as Record<string, unknown>).args = ["-y", "modified-pkg"];
      await deps.fs.writeFile(mcpPath, JSON.stringify(mcpContent, null, 2));

      const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
      const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

      const modified = report.tools[0].drifted.find(
        (d) => d.status === "modified" && d.relativePath.includes("playwright")
      );
      expect(modified).toBeDefined();
      expect(modified?.relativePath).toBe(".mcp.json > playwright");
    });

    it("detects deleted framework MCP server entry", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);

      const installUseCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        new FakePlatform("linux"),
        new OverwritePrompter(),
        deps.pluginFetcher,
        deps.pluginDistributionReader,
        deps.pluginCatalogRepository
      );
      await installUseCase.execute({
        toolIds: ["claude" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot: PROJECT_ROOT,
        mcpFilter: ["playwright", "github"],
      });

      const mcpPath = join(PROJECT_ROOT, ".mcp.json");
      const mcpContent = JSON.parse(deps.fs.getFile(mcpPath) ?? "{}") as {
        mcpServers: Record<string, unknown>;
      };
      delete mcpContent.mcpServers.playwright;
      await deps.fs.writeFile(mcpPath, JSON.stringify(mcpContent, null, 2));

      const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
      const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

      const deleted = report.tools[0].drifted.find(
        (d) => d.status === "deleted" && d.relativePath.includes("playwright")
      );
      expect(deleted).toBeDefined();
    });

    it("reports all entries as deleted when entire merge file is removed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);

      const installUseCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        new FakePlatform("linux"),
        new OverwritePrompter(),
        deps.pluginFetcher,
        deps.pluginDistributionReader,
        deps.pluginCatalogRepository
      );
      await installUseCase.execute({
        toolIds: ["claude" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot: PROJECT_ROOT,
        mcpFilter: ["playwright", "github"],
      });

      await deps.fs.deleteFile(join(PROJECT_ROOT, ".mcp.json"));

      const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
      const report = await useCase.execute({ projectRoot: PROJECT_ROOT });

      const deletedEntries = report.tools[0].drifted.filter(
        (d) => d.status === "deleted" && d.relativePath.includes(".mcp.json >")
      );
      expect(deletedEntries.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("compareSemver()", () => {
    it("orders lower major version as smaller", () => {
      expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    });

    it("orders lower minor version as smaller", () => {
      expect(compareSemver("3.1.0", "3.2.0")).toBe(-1);
    });

    it("orders higher patch version as greater", () => {
      expect(compareSemver("3.1.1", "3.1.0")).toBe(1);
    });

    it("treats identical versions as equal", () => {
      expect(compareSemver("3.1.0", "3.1.0")).toBe(0);
    });

    it("handles v-prefix", () => {
      expect(compareSemver("3.0.0", "v3.1.0")).toBe(-1);
    });
  });
});
